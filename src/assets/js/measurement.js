(() => {
	'use strict';
	const TAG_ID = 'AW-1014119307';
	const CONVERSION = `${TAG_ID}/jzR8CJe3kLQdEIv3yOMD`;
	const CONSENT_KEY = 'headshot.ads-consent.v1';
	const RECEIPT_KEY = 'headshot.callback-receipt.v1';
	const DAY = 86400000;
	const storage = {
		get(area, key) { try { return JSON.parse(window[area].getItem(key)); } catch { return null; } },
		set(area, key, value) { try { window[area].setItem(key, JSON.stringify(value)); } catch { /* Forms still work without storage. */ } },
		remove(area, key) { try { window[area].removeItem(key); } catch { /* Storage can be disabled. */ } }
	};
	const banner = document.getElementById('measurement-consent');
	const settings = document.getElementById('measurement-settings');
	let saved = storage.get('localStorage', CONSENT_KEY);
	let choice = saved && Date.now() - saved.at < 180 * DAY && ['granted', 'denied'].includes(saved.choice) ? saved.choice : null;
	let loading = false;
	let ready = false;
	let sent = false;
	window.dataLayer = window.dataLayer || [];
	window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
	window.gtag('consent', 'default', {
		ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied'
	});
	window.gtag('set', 'ads_data_redaction', true);

	function sendConfirmedLead() {
		if (choice !== 'granted' || !ready || sent || !/^\/koszonom\/?$/.test(window.location.pathname)) return;
		const receipt = storage.get('sessionStorage', RECEIPT_KEY);
		if (!receipt || typeof receipt.id !== 'string' || !Number.isFinite(receipt.at) || Date.now() - receipt.at > 30 * 60000 || receipt.at > Date.now()) {
			storage.remove('sessionStorage', RECEIPT_KEY);
			return;
		}
		// Consume before queueing: refresh/back must not send another conversion.
		sent = true;
		storage.remove('sessionStorage', RECEIPT_KEY);
		window.gtag('event', 'conversion', { send_to: CONVERSION, transaction_id: receipt.id });
	}

	function loadGoogleTag() {
		if (choice !== 'granted' || loading) return;
		loading = true;
		window.gtag('consent', 'update', {
			ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied'
		});
		window.gtag('js', new Date());
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtm.js?id=${TAG_ID}`;
		script.onload = () => { ready = true; sendConfirmedLead(); };
		script.onerror = () => { loading = false; };
		document.head.appendChild(script);
	}

	function clearAdvertisingCookies() {
		const parts = window.location.hostname.split('.');
		const domains = ['', ...parts.map((_, i) => parts.slice(i).join('.')).filter(d => d.includes('.'))];
		for (const cookie of document.cookie.split(';')) {
			const name = cookie.split('=')[0].trim();
			if (!name.startsWith('_gcl_') && name !== '_gac') continue;
			for (const domain of domains) {
				document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
			}
		}
	}

	if (banner) banner.hidden = choice !== null;
	settings?.addEventListener('click', () => {
		if (!banner) return;
		banner.hidden = false;
		banner.querySelector('[data-consent="denied"]')?.focus();
	});
	document.querySelector('[data-consent-privacy]')?.addEventListener('click', () => {
		if (typeof window.openModal === 'function') window.openModal();
	});
	document.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => {
		choice = button.dataset.consent;
		storage.set('localStorage', CONSENT_KEY, { choice, at: Date.now() });
		if (banner) banner.hidden = true;
		settings?.focus();
		if (choice === 'granted') {
			loadGoogleTag();
			sendConfirmedLead();
		} else {
			window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
			clearAdvertisingCookies();
			storage.remove('sessionStorage', RECEIPT_KEY);
			// Unload an already running Google tag after withdrawal.
			if (loading) window.location.reload();
		}
	}));
	if (choice === 'granted') loadGoogleTag();
	else clearAdvertisingCookies();

	const form = document.querySelector('form[name="kapcsolat"]');
	if (!form) return;
	let submitting = false;
	form.addEventListener('submit', async event => {
		event.preventDefault();
		if (submitting || !form.reportValidity()) return;
		const data = new FormData(form);
		if (data.get('very-special-field')) return;
		submitting = true;
		storage.remove('sessionStorage', RECEIPT_KEY);
		const button = form.querySelector('button[type="submit"]');
		const status = form.querySelector('.form-status');
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 20000);
		button.disabled = true;
		form.setAttribute('aria-busy', 'true');
		status.hidden = false;
		status.dataset.error = 'false';
		status.textContent = 'Küldés folyamatban…';
		try {
			const response = await fetch('/', {
				method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams(data).toString(), signal: controller.signal
			});
			if (!response.ok) throw new Error('Form submission was not accepted');
			// Set only after Netlify acknowledges the POST; no marker on button clicks.
			if (choice !== 'denied') storage.set('sessionStorage', RECEIPT_KEY, { id: window.crypto.randomUUID(), at: Date.now() });
			window.location.assign(form.getAttribute('action'));
		} catch {
			status.dataset.error = 'true';
			status.textContent = 'A beküldést nem sikerült visszaigazolni. Próbáld újra, vagy keress telefonon a +36 20 591 4620 számon.';
		} finally {
			window.clearTimeout(timer);
			button.disabled = false;
			form.removeAttribute('aria-busy');
			submitting = false;
		}
	});
})();
