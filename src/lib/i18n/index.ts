import { addMessages } from 'svelte-i18n';
import { init, getLocaleFromNavigator } from 'svelte-i18n'
import en from './en.json';
import et from './et.json';
import fi from './fi.json';

addMessages('en', en);
addMessages('et', et);
addMessages('fi', fi)

init({
    fallbackLocale: 'et',
    initialLocale: getLocaleFromNavigator(),
  });
export const uiLanguages = ['et', 'en', 'fi'];