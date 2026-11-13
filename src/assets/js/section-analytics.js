(() => {
	'use strict';
	if (!('IntersectionObserver' in window)) return;
	const seen = new Set();
	const pending = new Set();
	const visible = new Set();
	const timers = new Map();
	const names = new Map();

	function flush() {
		if (typeof window.AhrefsAnalytics?.sendEvent !== 'function') return;
		for (const section of pending) {
			try {
				window.AhrefsAnalytics.sendEvent('section_view', { props: { section } });
				pending.delete(section);
			} catch { /* A blocked analytics service must not affect the page. */ }
		}
	}

	function cancel(target) {
		window.clearTimeout(timers.get(target));
		timers.delete(target);
	}

	function start(target) {
		const section = names.get(target);
		if (document.visibilityState !== 'visible' || seen.has(section) || timers.has(target)) return;
		timers.set(target, window.setTimeout(() => {
			timers.delete(target);
			if (document.visibilityState !== 'visible' || !visible.has(target) || seen.has(section)) return;
			seen.add(section);
			pending.add(section);
			observer.unobserve(target);
			visible.delete(target);
			flush();
		}, 1000));
	}

	// Observe headings rather than entire sections: tall mobile galleries can
	// never reach a 50% visibility threshold for their full section height.
	const observer = new window.IntersectionObserver(entries => {
		for (const entry of entries) {
			if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
				visible.add(entry.target);
				start(entry.target);
			} else {
				visible.delete(entry.target);
				cancel(entry.target);
			}
		}
	}, { threshold: [0, 0.5] });

	document.querySelectorAll('[data-analytics-section]').forEach(section => {
		const target = section.querySelector('h1, h2, summary');
		if (!target) return;
		names.set(target, section.dataset.analyticsSection);
		observer.observe(target);
	});

	document.addEventListener('visibilitychange', () => {
		for (const target of visible) {
			cancel(target);
			if (document.visibilityState === 'visible') start(target);
		}
		if (document.visibilityState === 'visible') flush();
	});
	// The external script is asynchronous. Keep qualified views in memory
	// until its API loads, without cookies, localStorage or polling.
	document.querySelector('script[src="https://analytics.ahrefs.com/analytics.js"]')
		?.addEventListener('load', flush);
})();
