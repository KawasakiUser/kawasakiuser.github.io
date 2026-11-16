import { defineConfig } from 'astro/config';
export default defineConfig({site:'https://kawasakiuser.github.io',base:'/',output:'static',build:{format:'directory',inlineStylesheets:'always'},compressHTML:true});
