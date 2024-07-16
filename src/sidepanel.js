let images = [];
let allChecked = false;

document.addEventListener('DOMContentLoaded', function () {
  const applyFilterButton = document.getElementById('applyFilter');
  const toggleAllButton = document.getElementById('toggleAll');
  const downloadZipButton = document.getElementById('downloadZip');
  const imageListDiv = document.getElementById('imageList');
  const progressBar = document.getElementById('progressBar');
  const progress = document.querySelector('.progress');

  loadI18nStrings();
  getImages();  // 拡張機能が開いたときに即座に画像を取得

  applyFilterButton.addEventListener('click', applyFilter);
  toggleAllButton.addEventListener('click', toggleAllImages);
  downloadZipButton.addEventListener('click', downloadSelectedImages);

  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-all") {
      toggleAllImages();
    } else if (command === "download-zip") {
      downloadSelectedImages();
    }
  });

  function getImages() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getImages" }, function (response) {
        if (response && response.images) {
          images = response.images;
          displayImages(images);
        } else {
          showError(chrome.i18n.getMessage("errorFetchingImages"));
        }
      });
    });
  }

  function displayImages(images) {
    imageListDiv.innerHTML = '';
    images.forEach((img, index) => {
      const div = document.createElement('div');
      div.className = 'image-item';
      div.innerHTML = `
        <img src="${img.src}" alt="Image ${index}">
        <div>
          <input type="checkbox" id="img${index}" data-url="${img.src}">
          <label for="img${index}">${chrome.i18n.getMessage("selectImage")}</label>
        </div>
        <p>Width: ${img.width}px, Height: ${img.height}px<br>Size: ${formatFileSize(img.size)}</p>
      `;
      imageListDiv.appendChild(div);
    });
    updateToggleAllButton();
  }

  function applyFilter() {
    const minWidth = parseInt(document.getElementById('minWidth').value);
    const minHeight = parseInt(document.getElementById('minHeight').value);
    const fileType = document.getElementById('fileType').value;
    const maxFileSize = parseFloat(document.getElementById('maxFileSize').value) * 1024 * 1024; // Convert MB to bytes

    images.forEach((img, index) => {
      const checkbox = document.getElementById(`img${index}`);
      const meetsCriteria =
        img.width >= minWidth &&
        img.height >= minHeight &&
        (fileType === 'all' || img.src.toLowerCase().endsWith(fileType)) &&
        (maxFileSize === 0 || img.size <= maxFileSize);

      checkbox.checked = meetsCriteria;
    });

    updateToggleAllButton();
  }

  function toggleAllImages() {
    allChecked = !allChecked;
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = allChecked);
    updateToggleAllButton();
  }

  function updateToggleAllButton() {
    const toggleAllButton = document.getElementById('toggleAll');
    toggleAllButton.textContent = allChecked ? chrome.i18n.getMessage("uncheckAll") : chrome.i18n.getMessage("checkAll");
  }

  async function downloadSelectedImages() {
    const selectedUrls = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => checkbox.dataset.url);

    if (selectedUrls.length === 0) {
      showError(chrome.i18n.getMessage("noImagesSelected"));
      return;
    }

    const zip = new JSZip();
    let counter = 1;
    progressBar.style.display = 'block';

    for (let i = 0; i < selectedUrls.length; i++) {
      const url = selectedUrls[i];
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const contentType = response.headers.get('content-type');
        const extension = getExtensionFromContentType(contentType);
        const fileName = `image${String(counter).padStart(4, '0')}.${extension}`;
        zip.file(fileName, blob);
        counter++;

        // Update progress bar
        const percentComplete = ((i + 1) / selectedUrls.length) * 100;
        progress.style.width = `${percentComplete}%`;
      } catch (error) {
        console.error(`Failed to download image: ${url}`, error);
        showError(chrome.i18n.getMessage("errorDownloadingImage", url));
      }
    }

    zip.generateAsync({ type: "blob" }, updateCallback).then(function (content) {
      const url = URL.createObjectURL(content);
      chrome.downloads.download({
        url: url,
        filename: 'images.zip',
        saveAs: true
      });
      progressBar.style.display = 'none';
    });
  }

  function updateCallback(metadata) {
    const percentComplete = (metadata.percent | 0);
    progress.style.width = `${percentComplete}%`;
  }

  function getExtensionFromContentType(contentType) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/bmp': 'bmp'
    };
    return map[contentType] || 'jpg';
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function loadI18nStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const message = chrome.i18n.getMessage(el.dataset.i18n);
      if (message) el.textContent = message;
    });
  }
});

// content-script.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getImages") {
    const imgs = Array.from(document.getElementsByTagName('img'));
    const imagesInfo = imgs.map(img => ({
      src: img.src,
      width: img.naturalWidth,
      height: img.naturalHeight
    }));

    // Fetch file sizes
    Promise.all(imagesInfo.map(img =>
      fetch(img.src)
        .then(response => response.blob())
        .then(blob => ({ ...img, size: blob.size }))
        .catch(() => ({ ...img, size: 0 }))
    )).then(imagesWithSizes => {
      sendResponse({ images: imagesWithSizes });
    });

    return true; // Indicates that the response is sent asynchronously
  }
});
