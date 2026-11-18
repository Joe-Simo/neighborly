/**
 * Run from the head of every page. A page restored by the browser from an earlier visit may belong to a deploy whose
 * stylesheet is gone, and is then drawn as bare HTML. When the page has loaded (and again when it is shown from the
 * back-forward cache), the site's stylesheet is looked for by its marker (--kh-styled in globals.css); without it the page
 * is fetched afresh, at most once a minute for an address, so a page that truly cannot load its styles never loops.
 */
export const staleCheck = `(function(){function c(){try{if(getComputedStyle(document.documentElement).getPropertyValue("--kh-styled").trim()==="1")return;var k="kh-restyle:"+location.pathname,s=sessionStorage,t=+s.getItem(k)||0;if(Date.now()-t<6e4)return;s.setItem(k,String(Date.now()));location.reload()}catch(e){}}addEventListener("load",c);addEventListener("pageshow",function(e){if(e.persisted)c()})})()`;
