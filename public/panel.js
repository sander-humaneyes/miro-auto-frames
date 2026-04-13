(function () {
  const APP_NAME = 'Shrink frame to content';

  const state = {
    busy: false,
    frames: [],
    lastRun: null,
    selection: [],
  };

  const elements = {};

  function hasMiroContext() {
    return Boolean(window.miro && miro.board && miro.board.ui && miro.board.notifications);
  }

  function cacheElements() {
    elements.fitButton = document.getElementById('fit-button');
    elements.frameCount = document.getElementById('frame-count');
    elements.logsDisclosure = document.getElementById('logs-disclosure');
    elements.paddingInput = document.getElementById('padding-input');
    elements.resultList = document.getElementById('result-list');
    elements.resultSummary = document.getElementById('result-summary');
    elements.selectionStatus = document.getElementById('selection-status');
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    elements.fitButton.disabled = isBusy || state.frames.length === 0;
    elements.paddingInput.disabled = isBusy;
    elements.fitButton.textContent = isBusy ? 'Shrinking...' : 'Shrink';
  }

  function setUnavailableState() {
    elements.frameCount.dataset.active = 'false';
    elements.frameCount.textContent = '0';
    elements.selectionStatus.textContent = 'Open this app in Miro to shrink frames.';
    elements.fitButton.disabled = true;
    elements.paddingInput.disabled = true;
    elements.resultSummary.textContent = 'Preview only';
    elements.resultList.innerHTML = '';
    elements.logsDisclosure.open = false;
  }

  function renderSelection() {
    const selectionCount = state.selection.length;
    const frameCount = state.frames.length;

    elements.frameCount.dataset.active = frameCount ? 'true' : 'false';
    elements.frameCount.textContent = String(frameCount);

    if (!selectionCount) {
      elements.selectionStatus.textContent = 'Select one or more frames.';
      return;
    }

    if (!frameCount) {
      elements.selectionStatus.textContent =
        selectionCount === 1 ? 'The selected item is not a frame.' : 'None of the selected items are frames.';
      return;
    }

    if (frameCount === selectionCount) {
      elements.selectionStatus.textContent =
        frameCount === 1 ? '1 frame ready to shrink.' : `${frameCount} frames ready to shrink.`;
      return;
    }

    elements.selectionStatus.textContent =
      frameCount === 1
        ? `1 of ${selectionCount} selected items is a frame.`
        : `${frameCount} of ${selectionCount} selected items are frames.`;
  }

  function formatSummary(summary) {
    if (!summary) {
      return 'Nothing yet';
    }

    if (!summary.frameCount) {
      return 'No frames';
    }

    const parts = [];

    if (summary.successCount) {
      parts.push(`${summary.successCount} shrunk`);
    }

    if (summary.noopCount) {
      parts.push(`${summary.noopCount} unchanged`);
    }

    if (summary.skippedCount) {
      parts.push(`${summary.skippedCount} skipped`);
    }

    if (summary.errorCount) {
      parts.push(`${summary.errorCount} failed`);
    }

    return parts.join(' · ');
  }

  function resultStatusLabel(status) {
    if (status === 'success') {
      return 'Shrunk';
    }

    if (status === 'noop') {
      return 'Unchanged';
    }

    if (status === 'skipped') {
      return 'Skipped';
    }

    return 'Failed';
  }

  function renderResults() {
    elements.resultSummary.textContent = formatSummary(state.lastRun && state.lastRun.summary);
    elements.resultList.innerHTML = '';

    if (!state.lastRun || !state.lastRun.results.length) {
      return;
    }

    for (const result of state.lastRun.results) {
      const item = document.createElement('li');
      item.className = 'result-item';

      const head = document.createElement('div');
      head.className = 'result-head';

      const title = document.createElement('strong');
      title.className = 'result-title';
      title.textContent = result.frameLabel;

      const status = document.createElement('span');
      status.className = 'result-chip';
      status.dataset.variant = result.status;
      status.textContent = resultStatusLabel(result.status);

      const body = document.createElement('p');
      body.className = 'result-body';
      body.textContent = result.message;

      head.appendChild(title);
      head.appendChild(status);
      item.appendChild(head);
      item.appendChild(body);
      elements.resultList.appendChild(item);
    }
  }

  async function refreshSelection(selectionOverride) {
    const selection = selectionOverride !== undefined ? selectionOverride : await miro.board.getSelection();
    state.selection = selection;
    state.frames = selection.filter(window.AutoFrames.isFrame);
    renderSelection();
    setBusy(state.busy);
  }

  async function notifyForResult(run) {
    const { errorCount, frameCount, skippedCount, successCount } = run.summary;
    const firstError = run.results.find((result) => result.status === 'error');

    if (!frameCount) {
      await miro.board.notifications.showInfo('Select at least one frame before shrinking.');
      return;
    }

    if (errorCount) {
      if (successCount) {
        await miro.board.notifications.showError(`Shrank ${successCount} frame(s) and failed on ${errorCount}.`);
        return;
      }

      if (errorCount === 1 && firstError && firstError.notificationMessage) {
        await miro.board.notifications.showError(firstError.notificationMessage);
        return;
      }

      await miro.board.notifications.showError(`Failed to shrink ${errorCount} frame(s).`);
      return;
    }

    if (successCount) {
      const suffix = skippedCount ? `, skipped ${skippedCount}` : '';
      await miro.board.notifications.showInfo(`Shrank ${successCount} frame(s)${suffix}.`);
      return;
    }

    if (skippedCount) {
      await miro.board.notifications.showInfo(`Skipped ${skippedCount} frame(s).`);
      return;
    }

    await miro.board.notifications.showInfo('No selected frames needed shrinking.');
  }

  async function handleFit() {
    const padding = window.AutoFrames.sanitizePadding(elements.paddingInput.value);
    elements.paddingInput.value = String(padding);

    setBusy(true);

    try {
      const run = await window.AutoFrames.fitSelectedFrames({ padding });
      state.lastRun = run;
      renderResults();
      elements.logsDisclosure.open = Boolean(run.summary.errorCount || run.summary.skippedCount);
      await refreshSelection();
      await notifyForResult(run);
    } catch (error) {
      console.error(`${APP_NAME} failed to process the current selection`, error);
      await miro.board.notifications.showError('Could not shrink the selected frames.');
    } finally {
      setBusy(false);
    }
  }

  async function init() {
    cacheElements();
    renderResults();

    if (!hasMiroContext()) {
      setUnavailableState();
      return;
    }

    elements.fitButton.addEventListener('click', handleFit);

    const selectionUpdate = (event) => {
      refreshSelection(event.items).catch((error) => {
        console.error(`${APP_NAME} failed to refresh selection`, error);
      });
    };

    miro.board.ui.on('selection:update', selectionUpdate);
    window.addEventListener('pagehide', () => {
      miro.board.ui.off('selection:update', selectionUpdate);
    });

    await refreshSelection();
    setBusy(false);
  }

  init().catch(async (error) => {
    console.error(`${APP_NAME} panel failed to initialize`, error);
    try {
      await miro.board.notifications.showError('The panel failed to initialize.');
    } catch (notificationError) {
      console.error(`${APP_NAME} could not show its initialization error`, notificationError);
    }
  });
})();
