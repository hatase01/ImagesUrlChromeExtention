chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "getImages") {
        const images = Array.from(document.images).map(img => ({
            src: img.src,
            width: img.width,
            height: img.height
        }));
        sendResponse({ images: images });
    }
    return true;  // 非同期レスポンスのために必要
});