import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:7234",
				changeOrigin: true,
			},
			"/ws": {
				target: "ws://localhost:7235",
				ws: true,
			},
		},
	},
});
