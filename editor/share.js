// 共有用のクエリキーとステータス表示時間
const SHARE_QUERY_KEY = 'share';
const SHARE_STATUS_SHOW_MS = 2500;

// クエリやハッシュを除いた共有用URLを生成
// origin/pathname を組み立て直して「今開いているページの土台」を必ず使う
const getBaseShareUrl = () => {
  if (window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return window.location.href.split('?')[0].split('#')[0];
};

// クリップボード書き込みを試し、結果だけを返す
// ブラウザや権限によって失敗する可能性があるので例外は握りつぶしてハンドラ側で処理
const tryCopyToClipboard = async (text) => {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn('Clipboard copy failed', error);
    return false;
  }
};

export const initShareFeature = ({
  workspace,
  storage,
}) => {
  // 何度も触るDOM要素はここでキャッシュ
  // Modal関連はCode Modalと同じ挙動にしたいので同じクラス構成に揃えている
  const shareBtn = document.getElementById('shareBtn');
  const shareStatus = document.getElementById('shareStatus');
  const shareStatusText = document.getElementById('shareStatusText');
  const shareModal = document.getElementById('shareModal');
  const shareModalInput = document.getElementById('shareModalInput');
  const shareModalCopyBtn = document.getElementById('shareModalCopyBtn');
  const shareModalClose = document.getElementById('shareModalClose');

  let shareStatusTimer;
  // モーダル内のテキストボックスでURLの先頭(https...)が常に見えるようにする小技
  // setSelectionRangeを使えるブラウザでは0~lengthを選択して即座にコピーできる状態にする
  const ensureUrlVisible = () => {
    if (!shareModalInput) return;
    shareModalInput.select();
    if (typeof shareModalInput.setSelectionRange === 'function') {
      shareModalInput.setSelectionRange(0, shareModalInput.value.length);
    }
    shareModalInput.scrollLeft = 0;
  };

  // 共有状態を伝えるピル状トースト
  // 「Saved」と同じ挙動になるように、data-show属性のON/OFFとCSSトランジションを使う
  const showShareStatus = (message, state = 'info') => {
    if (!shareStatus || !shareStatusText) return;
    shareStatusText.textContent = message;
    shareStatus.dataset.state = state;
    shareStatus.setAttribute('data-show', 'true');
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatusTimer = setTimeout(() => {
      shareStatus.setAttribute('data-show', 'false');
    }, SHARE_STATUS_SHOW_MS);
  };

  // 共有モーダルの開閉制御
  // Code Modalのアニメーションを参考に、hidden/flex + show-modalクラスで開閉を統一
  const toggleShareModal = (isOpen, url = '') => {
    if (!shareModal || !shareModalInput) return;
    shareModal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) {
      shareModalInput.value = url;
      shareModal.classList.remove('hidden');
      shareModal.classList.add('flex');
      void shareModal.offsetWidth;
      shareModal.classList.add('show-modal');
      setTimeout(() => {
        shareModalInput.focus();
        ensureUrlVisible();
      }, 0);
    } else {
      shareModal.classList.remove('show-modal');
      setTimeout(() => {
        shareModal.classList.remove('flex');
        shareModal.classList.add('hidden');
      }, 300);
      shareModalInput.value = '';
    }
  };

  // ワークスペースをURI安全な文字列にして共有URLを返却
  // LZStringのEncodedURIComponent版を使うことで=や/を含まない短いクエリに圧縮できる
  const generateShareUrl = () => {
    if (!workspace) throw new Error('WORKSPACE_NOT_READY');
    if (!window.LZString || typeof window.LZString.compressToEncodedURIComponent !== 'function') {
      throw new Error('LZSTRING_NOT_AVAILABLE');
    }
    const xml = Blockly.Xml.workspaceToDom(workspace);
    const xmlText = Blockly.Xml.domToText(xml);
    const encoded = window.LZString.compressToEncodedURIComponent(xmlText);
    if (!encoded) throw new Error('ENCODE_FAILED');
    return `${getBaseShareUrl()}?${SHARE_QUERY_KEY}=${encoded}`;
  };

  // URLクエリに埋め込まれた共有データを適用
  // 成功したらlocalStorageにも反映し、その後クエリをクリーンアップして再読込で重複適用されないようにする
  const applySharedLayoutFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(SHARE_QUERY_KEY);
    if (!encoded) return false;

    if (!window.LZString || typeof window.LZString.decompressFromEncodedURIComponent !== 'function') {
      showShareStatus('共有データの読み込みに失敗しました', 'error');
      return false;
    }

    try {
      const xmlText = window.LZString.decompressFromEncodedURIComponent(encoded);
      if (!xmlText) throw new Error('DECODE_RESULT_EMPTY');
      const loaded = storage?.importText(xmlText);
      if (!loaded) throw new Error('LOAD_FAILED');
      showShareStatus('共有レイアウトを読み込みました', 'success');
      if (typeof window.history.replaceState === 'function') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return true;
    } catch (error) {
      console.warn('Failed to read shared layout', error);
      showShareStatus('共有データを適用できませんでした', 'error');
      if (typeof window.history.replaceState === 'function') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return false;
    }
  };

  // Shareボタンが押されたときのメイン処理
  // URL生成→モーダル表示→自動コピーの順で動き、エラー時はトーストで告知
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (shareBtn.disabled) return;
      shareBtn.disabled = true;
      shareBtn.setAttribute('aria-busy', 'true');
      try {
        const shareUrl = generateShareUrl();
        toggleShareModal(true, shareUrl);
      } catch (error) {
        console.error('Failed to generate share url', error);
        showShareStatus('共有リンクの生成に失敗しました', 'error');
      } finally {
        shareBtn.disabled = false;
        shareBtn.removeAttribute('aria-busy');
      }
    });
  }

  // モーダル内の閉じるボタンや背景クリック、Escキーでも閉じられるようにしてUXを揃える
  if (shareModalClose) {
    shareModalClose.addEventListener('click', () => toggleShareModal(false));
  }
  if (shareModal) {
    shareModal.addEventListener('click', (event) => {
      if (event.target === shareModal) toggleShareModal(false);
    });
  }
  // 入力欄をクリック/フォーカスした際に常に全選択させてコピーしやすくする
  if (shareModalInput) {
    shareModalInput.addEventListener('focus', ensureUrlVisible);
    shareModalInput.addEventListener('click', ensureUrlVisible);
  }
  // 手動で「リンクをコピー」ボタンを押した場合の処理
  // 自動コピーに失敗した環境でもここで再チャレンジできる
  if (shareModalCopyBtn) {
    shareModalCopyBtn.addEventListener('click', async () => {
      if (!shareModalInput) return;
      ensureUrlVisible();
      const copied = await tryCopyToClipboard(shareModalInput.value);
      if (copied) {
        showShareStatus('共有リンクをコピーしました！', 'success');
      } else {
        showShareStatus('クリップボードにアクセスできません', 'error');
      }
    });
  }
  // モーダルを開いたままEscを押した場合でも閉じられるようにグローバルで監視
  if (shareModal) {
    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        !shareModal.classList.contains('hidden')
      ) {
        toggleShareModal(false);
      }
    });
  }

  return { applySharedLayoutFromQuery };
};
