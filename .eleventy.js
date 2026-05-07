const Image = require("@11ty/eleventy-img");
const path = require("path");

module.exports = function (eleventyConfig) {
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
			urlPath: "/assets/images/gallery/generated/",
			outputDir: "./public/assets/images/gallery/generated/",
			filenameFormat: function(id, src, width, format) {
				const { name } = path.parse(src);
				return `${name}-${width}.${format}`;
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
			class: "gallery__photo js-lightbox"
		};

		const originalSrc = src.replace("./src", "");

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
			urlPath: "/assets/images/generated/examples/",
			outputDir: "./public/assets/images/generated/examples/",
			filenameFormat: function(id, src, width, format) {
				const { name } = path.parse(src);
				return `${name}-${width}.${format}`;
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
