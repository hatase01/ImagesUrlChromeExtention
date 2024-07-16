chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "getImages") {
        const minWidth = request.minWidth;
        const minHeight = request.minHeight;
        const fileType = request.fileType;
        const maxFileSize = request.maxFileSize;

        const imgs = Array.from(document.getElementsByTagName('img'));
        const filteredImages = imgs.filter(img => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const src = img.src;
            const extension = src.split('.').pop().toLowerCase();

            return width >= minWidth &&
                height >= minHeight &&
                (fileType === 'all' || extension === fileType);
        }).map(img => ({
            src: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight
        }));

        // Fetch file sizes
        Promise.all(filteredImages.map(img =>
            fetch(img.src)
                .then(response => response.blob())
                .then(blob => ({ ...img, size: blob.size }))
                .catch(() => ({ ...img, size: 0 }))
        )).then(imagesWithSizes => {
            const finalFilteredImages = imagesWithSizes.filter(img => img.size <= maxFileSize || maxFileSize === 0);
            sendResponse({ images: finalFilteredImages });
        });

        return true; // Indicates that the response is sent asynchronously
    }
});
