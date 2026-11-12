const Image = require("@11ty/eleventy-img");
const path = require("path");
const fs = require("node:fs");
const crypto = require("node:crypto");

function assetUrl(url) {
	const assetPath = url.split("?")[0];
	const bytes = fs.readFileSync(path.join(__dirname, "src", "." + assetPath));
	const version = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
	return `${assetPath}?v=${version}`;
}

module.exports = function (eleventyConfig) {
	eleventyConfig.addFilter("assetUrl", assetUrl);
	// --- STATIC FILES ---
	eleventyConfig.addPassthroughCopy("src/_headers");
	eleventyConfig.addPassthroughCopy("src/favicon.ico");
	eleventyConfig.addPassthroughCopy("src/assets");
	eleventyConfig.addPassthroughCopy("src/assets/js");

	eleventyConfig.addWatchTarget("src/assets/css");
	eleventyConfig.addWatchTarget("src/assets/js");
	eleventyConfig.setQuietMode(true);

	// --- GALLERY IMAGE SHORTCODE ---
	async function imageShortcode(
		src,
		alt,
		sizes = `
			(max-width: 575px) calc((100vw - 3rem) / 2),
			(max-width: 991px) calc((100vw - 6.5rem) / 3),
			(max-width: 1399px) calc((100vw - 10.5rem) / 4),
			220px
		`
	) {
		let metadata = await Image(src, {
			widths: [320, 480, 800],
			formats: ["webp"],
			urlPath: "/assets/images/gallery/optimized/",
			outputDir: "./public/assets/images/gallery/optimized/",
			filenameFormat: function(id, src, width, format) {
				const { name } = path.parse(src);
				return `${name}-${id}-${width}.${format}`;
			},
			sharpWebpOptions: {
				quality: 85
			}
		});

		let imageAttributes = {
			alt,
			sizes,
			loading: "lazy",
			decoding: "async",
			class: "gallery__image js-lightbox",
			role: "button",
			tabindex: "0",
			"aria-haspopup": "dialog",
			"aria-controls": "lightbox"
		};

		const originalSrc = assetUrl(src.replace("./src", ""));

		const html = Image.generateHTML(
			metadata,
			imageAttributes,
			{ whitespaceMode: "inline" }
		);

		return html.replace(
			"<img ",
			`<img data-highres="${originalSrc}" `
		);
	}

	eleventyConfig.addAsyncShortcode("image", imageShortcode);

	// --- EXAMPLE IMAGE SHORTCODE ---
	async function exampleImageShortcode(
		src,
		alt,
		sizes = `
			(max-width: 767px) calc(100vw - 2rem),
			(max-width: 1399px) calc((100vw - 9rem) / 2),
			670px
		`
	) {
		let metadata = await Image(src, {
			widths: [400, 600, 800],
			formats: ["webp"],
			urlPath: "/assets/images/optimized/examples/",
			outputDir: "./public/assets/images/optimized/examples/",
			filenameFormat: function(id, src, width, format) {
				const { name } = path.parse(src);
				return `${name}-${id}-${width}.${format}`;
			},
			sharpWebpOptions: {
				quality: 80
			}
		});

		let imageAttributes = {
			alt,
			sizes,
			loading: "lazy",
			decoding: "async",
			class: "example__image"
		};

		return Image.generateHTML(metadata, imageAttributes, {
			whitespaceMode: "inline"
		});
	}

	eleventyConfig.addAsyncShortcode("exampleImage", exampleImageShortcode);

	// --- DIRECTORIES ---
	return {
		dir: {
			input: "src",
			output: "public",
			includes: "_includes"
		}
	};
};
