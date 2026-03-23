/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_PROSOPO_SITE_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
