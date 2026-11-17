/**
 * Run from the root layout's head, before anything is drawn, so the app's pages already say their language on a
 * fresh load: the one chosen at the door, else the device's (the same answer as deviceLanguage in live-auth-words.ts).
 * The public pages are English and are left alone. Arriving by a link inside the site runs no script, so there
 * <PageLanguage /> gives the same answer before the first paint.
 */
export const firstLanguage = `(function(){try{if(!/^\\/(app|offline)(\\/|$)/.test(location.pathname))return;var k=["en","es"],c=null;try{c=localStorage.getItem("kind-helps:language")}catch(e){}var l=k.indexOf(c)>-1?c:null;if(!l){var n=navigator.languages||[];for(var i=0;i<n.length&&!l;i++){for(var j=0;j<k.length;j++){if(n[i].toLowerCase().indexOf(k[j])===0){l=k[j];break}}}}document.documentElement.lang=l||"en"}catch(e){}})()`;
