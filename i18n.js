export function message(key,substitutions) {
 return chrome.i18n.getMessage(key,substitutions)||key;
}

// The language of the loaded message catalog, not of the browser UI: dates, numbers and lang follow the text.
export const textLocale=message('textLocale');

export function applyTranslations(root=document) {
 document.documentElement.lang=textLocale;
 document.documentElement.dir='ltr';
 for(const element of root.querySelectorAll('[data-i18n]'))element.textContent=message(element.dataset.i18n);
 for(const [attribute,dataKey] of [['placeholder','i18nPlaceholder'],['aria-label','i18nAriaLabel'],['title','i18nTitle']]) {
  for(const element of root.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}]`))element.setAttribute(attribute,message(element.dataset[dataKey]));
 }
 document.title=message('pageTitle');
}
