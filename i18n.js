export function message(key,substitutions) {
 return chrome.i18n.getMessage(key,substitutions)||key;
}

export function applyTranslations(root=document) {
 const locale=chrome.i18n.getMessage('@@ui_locale')||'en';
 document.documentElement.lang=locale.replace('_','-');
 document.documentElement.dir=chrome.i18n.getMessage('@@bidi_dir')||'ltr';
 for(const element of root.querySelectorAll('[data-i18n]'))element.textContent=message(element.dataset.i18n);
 for(const [attribute,dataKey] of [['placeholder','i18nPlaceholder'],['aria-label','i18nAriaLabel'],['title','i18nTitle']]) {
  for(const element of root.querySelectorAll(`[data-${dataKey.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}]`))element.setAttribute(attribute,message(element.dataset[dataKey]));
 }
 document.title=message('pageTitle');
}
