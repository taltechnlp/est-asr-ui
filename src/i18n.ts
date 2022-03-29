import { addMessages } from 'svelte-i18n';
import { init, getLocaleFromNavigator } from 'svelte-i18n'
import en from './en.json';
import et from './et.json';

addMessages('en', en);
addMessages('et', et);

init({
    fallbackLocale: 'et',
    initialLocale: getLocaleFromNavigator(),
  });
