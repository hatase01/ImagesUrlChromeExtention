$(document).ready(function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]) {
      $('#imageContainer').html('<p>Error: No active tab found.</p>');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: "getImages" }, function (response) {
      if (chrome.runtime.lastError) {
        $('#imageContainer').html('<p>Error: ' + chrome.runtime.lastError.message + '</p>');
        return;
      }

      if (response && Array.isArray(response.images)) {
        const $imageContainer = $('#imageContainer');
        if (response.images.length === 0) {
          $imageContainer.html('<p>No images found on this page.</p>');
        } else {
          response.images.forEach(img => {
            const $card = createImageCard(img);
            $imageContainer.append($card);
          });
        }
      } else {
        $('#imageContainer').html('<p>Error: Invalid response format</p>');
      }
    });
  });

  $('#selectAll').click(function () {
    $('.image-checkbox').prop('checked', true);
  });

  $('#deselectAll').click(function () {
    $('.image-checkbox').prop('checked', false);
  });

  $('#selectLarge').click(function () {
    $('.image-checkbox').each(function () {
      const width = $(this).data('width');
      const height = $(this).data('height');
      $(this).prop('checked', width >= 100 && height >= 100);
    });
  });

  $('#downloadZip').click(function () {
    const selectedUrls = $('.image-checkbox:checked').map(function () {
      return $(this).data('url');
    }).get();

    if (selectedUrls.length > 0) {
      downloadImagesAsZip(selectedUrls);
    } else {
      alert('No images selected!');
    }
  });

  $('#copySelected').click(function () {
    const selectedUrls = $('.image-checkbox:checked').map(function () {
      return $(this).data('url');
    }).get();

    if (selectedUrls.length > 0) {
      const urlString = selectedUrls.join('\n');
      navigator.clipboard.writeText(urlString).then(function () {
        alert('Selected URLs copied to clipboard!');
      }, function (err) {
        console.error('Could not copy text: ', err);
      });
    } else {
      alert('No URLs selected!');
    }
  });
});

function createImageCard(img) {
  const $card = $('<div>').addClass('card');

  const $checkboxContainer = $('<div>').addClass('checkbox-container');
  const $checkbox = $('<input>')
    .attr('type', 'checkbox')
    .addClass('image-checkbox')
    .data('url', img.src)
    .data('width', img.width)
    .data('height', img.height);
  $checkboxContainer.append($checkbox);

  const $thumbnail = $('<img>')
    .attr('src', img.src)
    .addClass('thumbnail');

  const $cardContent = $('<div>').addClass('card-content');

  const $urlInput = $('<input>')
    .attr('type', 'text')
    .val(img.src)
    .addClass('url-input');

  const $infoSpan = $('<span>')
    .text(`${img.width}x${img.height} - ${getFileExtension(img.src)}`)
    .addClass('info');

  const $copyButton = $('<button>')
    .html('<i class="fas fa-copy"></i> Copy URL')
    .addClass('copy-btn')
    .click(function () {
      $urlInput.select();
      document.execCommand('copy');
      $(this).html('<i class="fas fa-check"></i> Copied!');
      setTimeout(() => $(this).html('<i class="fas fa-copy"></i> Copy URL'), 2000);
    });

  $cardContent.append($checkboxContainer, $urlInput, $infoSpan, $copyButton);
  $card.append($thumbnail, $cardContent);

  return $card;
}

function getFileExtension(url) {
  return url.split('.').pop().split(/\#|\?/)[0].toLowerCase();
}

function downloadImagesAsZip(urls) {
  const zip = new JSZip();
  const fetchPromises = urls.map((url, index) =>
    fetch(url, { mode: 'cors', credentials: 'include' })
      .then(response => response.blob())
      .then(blob => {
        ct = response.getResponseHeader("Content-Type");
        if (ct == "image/png") {
          const extention = 'png';
        } else if (ct == "image/svg+xml") {
          const extension = 'svg';
        } else {
          const extension = 'jpg';
        }
        //const extension = url.split('.').pop().split(/\#|\?/)[0];
        zip.file(`image${index + 1}.${extension}`, blob);
      })
  );

  Promise.all(fetchPromises)
    .then(() => zip.generateAsync({ type: "blob" }))
    .then(content => {
      const url = URL.createObjectURL(content);
      chrome.downloads.download({
        url: url,
        filename: 'images.zip',
        saveAs: true
      });
    })
    .catch(error => {
      console.error('Error creating ZIP:', error);
      alert('Error creating ZIP file. Check console for details.');
    });
}