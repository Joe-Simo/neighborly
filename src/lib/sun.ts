/**
 * Real light, one sun for the whole public world: set once, before the first paint, from the visitor's own hour, and never moved while seen.
 * The house light (the angle the art was cut under, down and about 35° to the right) holds at about 13:00 and swings at most 25° either way:
 * further right in the morning, sun low in the east (the page's left), nearer straight down by evening; held at its ends before 7 and after 19.
 * A low sun throws longer shadows: up to 1.4 times the house length at the ends. Direction and length only, never a tint.
 * The page reads --sun-s and --sun-c (the cast's direction from straight down), --sun-t (how far a straight-down shadow now leans, as a tangent)
 * and --sun-k (the length). Without script every shadow keeps the house light. The workspace is a tool, not a scene: it never reads them.
 */
export const sunLight = "try{var d=new Date(),h=Math.min(19,Math.max(7,d.getHours()+d.getMinutes()/60)),v=(13-h)/6*25*Math.PI/180,a=35*Math.PI/180+v,s=document.documentElement.style;s.setProperty('--sun-s',Math.sin(a).toFixed(3));s.setProperty('--sun-c',Math.cos(a).toFixed(3));s.setProperty('--sun-t',Math.tan(v).toFixed(3));s.setProperty('--sun-k',(1+.4*Math.abs(h-13)/6).toFixed(3))}catch(e){}";
