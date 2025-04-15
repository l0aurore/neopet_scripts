// ==UserScript==
// @name         Restocking Profit Highlighter (2)
// @namespace    http://neopets.lipomancer.com/
// @version      1.0
// @description  Automatically highlights profitable items in Neopets stores.
// @author       MediaTriggerWords, modified by Lipomancer, modified by Laurore
// @match        *://www.neopets.com/*
// ==/UserScript==

(function() {

    var patterns = [], classes = [];
    addGlobalStyle('span.red { background-color: #000000; color: #ff1a00; } ' +
           'span.yellow { background-color: #000000; color: #fdff00;} ' +
           'span.green { background-color: #000000; color: #23ea11;} ' +
           'span.blank { background-color: #ffffff; color: #ffffff} ' );
    defwords([
        "replace",
        ], "blank");
    defwords([
        "Toffee Ice Cream",
                ], "red");
    defwords([
        "Replace yellow",
         ], "yellow");
    defwords([
        "Replace green",
         ], "green");
    function defwords(words, which_class) {
    for (var i = 0; i < words.length; i++) {
        var w = words[i].replace(/^=/, "");
        patterns.push(new RegExp("([^a-zA-Z])(" + w + ")([^a-zA-Z])",
        words[i].match(/^=/) ? "g" : "gi"));
        classes.push(which_class);
    }}
    function quoteHTML(s) {
    s = s.replace(/&/g, "&amp;");
    s = s.replace(/</g, "&lt;");
    s = s.replace(/>/g, "&gt;");
    return s;
    }
    function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) {
        return;
    }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
    }
    var curpat;
    var changes;
    function repmatch(matched, before, word, after) {
    changes++;
    return before + '<span class="' + classes[curpat] +' ">' + word + '</span>' + after;
    }
    function highlight(s) {
    s = " " + s;
    for (curpat = 0; curpat < patterns.length; curpat++) {
        s = s.replace(patterns[curpat],
            repmatch);
    }
    return s.substring(1);
    }
    if (document.contentType &&
        (!(document.contentType.match(/html/i)))) {
        return;
    }
    var textnodes = document.evaluate("//body//text()", document, null,
        XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0; i < textnodes.snapshotLength; i++) {
    var node = textnodes.snapshotItem(i);
    if (node.parentNode.tagName != "STYLE" &&
        node.parentNode.tagName != "TEXTAREA" &&
        node.parentNode.tagName != "SCRIPT") {
        if (!(node.data.match(/^\s*$/))) {
        var s = " " + node.data + " ";
        changes = 0;
        var d = highlight(quoteHTML(s));
        if (changes > 0) {
            var rep = document.createElement("span");
            rep.innerHTML = d.substring(1, d.length - 1);
            node.parentNode.replaceChild(rep, node);
        }
        }
    }
    }
})();
