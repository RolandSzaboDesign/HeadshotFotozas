const Image = require("@11ty/eleventy-img");
const path = require("path");

module.exports = function (eleventyConfig) {
	// --- STATIC FILES ---
	eleventyConfig.addPassthroughCopy("src/favicon.ico");
	eleventyConfig.addPassthroughCopy("src/assets");
	eleventyConfig.addPassthroughCopy("src/assets/js");

	eleventyConfig.addWatchTarget("src/assets/css");
	eleventyConfig.addWatchTarget("src/assets/js");
	eleventyConfig.setQuietMode(true);

	// --- IMAGE SHORTCODE ---
	async function imageShortcode(src, alt, sizes = "(max-width: 991px) 50vw, (max-width: 1199px) 33vw, 33vw") {
		let metadata = await Image(src, {
			widths: [480, 600, 800],
			formats: ["webp"],
			urlPath: "/assets/images/gallery/",
			outputDir: "./public/assets/images/gallery/",
			filenameFormat: function (id, src, width, format) {
				const { name } = path.parse(src);
				return `${name}-${width}.${format}`;
			},
			sharpWebpOptions: { quality: 85 }
		});

		let imageAttributes = {
			alt,
			sizes,
			loading: "lazy",
			decoding: "async",
			class: "js-lightbox"
		};

		const originalSrc = src.replace("./src", "");
		const html = Image.generateHTML(metadata, imageAttributes, { whitespaceMode: "inline" });
		return html.replace("<img ", `<img data-highres="${originalSrc}" `);
	}

	eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
	eleventyConfig.addLiquidShortcode("image", imageShortcode);

	// --- DIRECTORIES ---
	return {
		dir: {
			input: "src",
			output: "public",
			includes: "_includes"
		}
	};
};
