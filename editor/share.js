// 共有用のクエリキーとステータス表示時間
const SHARE_QUERY_KEY = 'share';
const SHARE_STATUS_SHOW_MS = 2500;
const BLOCKLY_CAPTURE_EXTRA_CSS = [
  // 通常CSSでは対応しきれないBlocklyキャプチャ用の追加スタイル (SVGはfillで指定する必要があるため、ここで上書き)
  ".blocklyText { fill:#fff !important; }",
  ".blocklyEditableText { fill: #fff !important; }",
  ".blocklyEditableText .blocklyText:not(.blocklyDropdownText) { fill:#000 !important; }",
].join('');
let blocklyOverrideCssCache = '';

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
  const shareModalXBtn = document.getElementById('shareModalXBtn');
  const shareModalClose = document.getElementById('shareModalClose');
  const shareThumbnailWrapper = document.getElementById('shareThumbnailWrapper');
  const shareThumbnailImage = document.getElementById('shareThumbnailImage');
  const shareThumbnailMessage = document.getElementById('shareThumbnailMessage');
  const shareThumbnailCopyBtn = document.getElementById('shareThumbnailCopyBtn');
  let shareThumbnailDataUrl = '';

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

  const toBase64Svg = (svgString) =>
    `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svgString)))}`;

  const setShareThumbnailState = (state, dataUrl = '') => {
    if (!shareThumbnailImage || !shareThumbnailMessage || !shareThumbnailWrapper) return;
    if (state === 'ready' && dataUrl) {
      shareThumbnailImage.src = dataUrl;
      shareThumbnailImage.classList.remove('hidden');
      shareThumbnailMessage.classList.add('hidden');
      shareThumbnailWrapper.classList.remove('opacity-70');
      shareThumbnailDataUrl = dataUrl;
      if (shareThumbnailCopyBtn) shareThumbnailCopyBtn.disabled = false;
      return;
    }
    shareThumbnailImage.classList.add('hidden');
    shareThumbnailWrapper.classList.toggle('opacity-70', state !== 'hidden');
    shareThumbnailMessage.classList.toggle('hidden', state === 'hidden');
    shareThumbnailDataUrl = '';
    if (shareThumbnailCopyBtn) shareThumbnailCopyBtn.disabled = true;
    if (state === 'loading') {
      shareThumbnailMessage.textContent = 'ワークスペースを撮影しています...';
    } else if (state === 'error') {
      shareThumbnailMessage.textContent = 'サムネイルの生成に失敗しました。再試行してください。';
    } else {
      shareThumbnailMessage.textContent = '';
    }
  };

  const captureWorkspaceThumbnail = async () => {
    if (!workspace) throw new Error('WORKSPACE_NOT_READY');

    const canvasSvg = workspace.getCanvas?.() ?? workspace.svgBlockCanvas_;
    if (!canvasSvg) throw new Error('CANVAS_NOT_FOUND');

    const blocks = workspace.getAllBlocks(false);
    if (!blocks.length) throw new Error('NO_BLOCKS_FOUND');

    const clonedCanvas = canvasSvg.cloneNode(true);
    ['width', 'height', 'transform'].forEach((attr) =>
      clonedCanvas.removeAttribute(attr)
    );

    const cssPayload = (window.Blockly?.Css?.CONTENT || []).join('') + BLOCKLY_CAPTURE_EXTRA_CSS;
    clonedCanvas.insertAdjacentHTML('afterbegin', `<style>${cssPayload}</style>`);

    const bbox = canvasSvg.getBBox();
    const padding = 32;
    const minDimension = 64;
    const viewWidth = Math.max(minDimension, Math.ceil(bbox.width + padding * 2));
    const viewHeight = Math.max(minDimension, Math.ceil(bbox.height + padding * 2));
    const viewX = bbox.x - padding;
    const viewY = bbox.y - padding;

    const xml = new XMLSerializer().serializeToString(clonedCanvas);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="${viewX} ${viewY} ${viewWidth} ${viewHeight}">${xml}</svg>`;

    // // DEBUG: コメントアウト解除して直接SVGを表示 (デバッグ用)
    // shareThumbnailWrapper.innerHTML = svg;

    const svgDataUrl = toBase64Svg(svg);
    const scaleFactor = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewWidth * scaleFactor);
        canvas.height = Math.ceil(viewHeight * scaleFactor);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('CANVAS_CONTEXT_NOT_AVAILABLE'));
        ctx.scale(scaleFactor, scaleFactor);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = svgDataUrl;
    });
  };

  const refreshShareThumbnail = async () => {
    if (!shareModal || shareModal.classList.contains('hidden')) return null;
    setShareThumbnailState('loading');
    try {
      const dataUrl = await captureWorkspaceThumbnail();
      if (dataUrl) {
        setShareThumbnailState('ready', dataUrl);
      } else {
        setShareThumbnailState('error');
      }
      return dataUrl;
    } catch (error) {
      console.error('Failed to capture workspace thumbnail', error);
      setShareThumbnailState('error');
      return null;
    } finally {
      // no manual refresh button to toggle
    }
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
        setShareThumbnailState('loading');
        refreshShareThumbnail();
      }, 0);
    } else {
      shareModal.classList.remove('show-modal');
      setTimeout(() => {
        shareModal.classList.remove('flex');
        shareModal.classList.add('hidden');
      }, 300);
      shareModalInput.value = '';
      setShareThumbnailState('hidden');
    }
  };

  // ワークスペースをURI安全な文字列にして共有URLを返却
  // LZStringのEncodedURIComponent版を使うことで=や/を含まない短いクエリに圧縮できる
  const generateShareUrl = () => {
    if (!workspace) throw new Error('WORKSPACE_NOT_READY');
    if (!window.LZString || typeof window.LZString.compressToEncodedURIComponent !== 'function') {
      throw new Error('LZSTRING_NOT_AVAILABLE');
    }
    const serialized = storage.exportText({ pretty: false });
    const encoded = window.LZString.compressToEncodedURIComponent(serialized);
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

  if (shareThumbnailCopyBtn) {
    shareThumbnailCopyBtn.addEventListener('click', async () => {
      if (!shareThumbnailDataUrl) return;
      if (
        !navigator.clipboard ||
        typeof navigator.clipboard.write !== 'function' ||
        typeof window.ClipboardItem !== 'function'
      ) {
        showShareStatus('クリップボードに画像をコピーできません', 'error');
        return;
      }
      try {
        const blob = await (await fetch(shareThumbnailDataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showShareStatus('プレビュー画像をコピーしました！', 'success');
      } catch (error) {
        console.error('Failed to copy thumbnail', error);
        showShareStatus('画像のコピーに失敗しました', 'error');
      }
    });
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
  // Xへ直接ポストするためのボタン。別タブで intent を開く。
  if (shareModalXBtn) {
    shareModalXBtn.addEventListener('click', () => {
      if (!shareModalInput || !shareModalInput.value) return;
      const baseText = encodeURIComponent('Easy Discord Bot BuilderでDiscord BOTを作成しました！ #EDBB');
      const encodedUrl = encodeURIComponent(shareModalInput.value);
      const intentUrl = `https://x.com/intent/tweet?text=${baseText}%0A${encodedUrl}`;
      window.open(intentUrl, '_blank', 'noopener,noreferrer');
      showShareStatus('Xのポスト画面を開きました', 'info');
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
