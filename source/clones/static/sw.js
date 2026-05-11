importScripts("/controller/controller.sw.js");

addEventListener("fetch", (e) => {
    if ($scramjetController.shouldRoute(e)) {
        e.respondWith(
            $scramjetController.route(e).then((response) => {
                if (response.headers.get("content-type")?.includes("text/html")) {
                    return response.text().then((html) => {
                        const injectedHtml = html.replace(
                            "</head>",
                            `<script>
                                (function() {
                                    let lastTitle = document.title;
                                    let lastFavicon = "";
                                    
                                    function getFaviconUrl() {
                                        const link = document.querySelector("link[rel*='icon']");
                                        return link ? link.href : "";
                                    }
                                    
                                    function sendUpdates() {
                                        const currentTitle = document.title;
                                        const currentFavicon = getFaviconUrl();
                                        
                                        if (currentTitle !== lastTitle) {
                                            lastTitle = currentTitle;
                                            window.parent.postMessage({ type: "TITLE_CHANGE", title: currentTitle }, "*");
                                        }
                                        
                                        if (currentFavicon !== lastFavicon) {
                                            lastFavicon = currentFavicon;
                                            window.parent.postMessage({ type: "FAVICON_CHANGE", favicon: currentFavicon }, "*");
                                        }
                                    }
                                    
                                    const observer = new MutationObserver(sendUpdates);
                                    observer.observe(document.querySelector("head"), { childList: true, subtree: true, characterData: true });
                                    
                                    window.addEventListener("load", sendUpdates);
                                    sendUpdates();
                                })();
                            </script></head>`
                        );
                        return new Response(injectedHtml, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                        });
                    });
                }
                return response;
            })
        );
    }
});
