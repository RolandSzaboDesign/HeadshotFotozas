// Prevent Default
document.addEventListener('DOMContentLoaded', () => {
	document.querySelectorAll('.js-prevent-default').forEach((el) => {
		el.addEventListener('click', (e) => {
			e.preventDefault();
		});
	});
});



// Scroll Lock
function lockBodyScroll() {
	const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
	if (scrollBarWidth > 0) {
		document.body.style.paddingRight = `${scrollBarWidth}px`;
	}
	document.body.classList.add('scroll-lock');
}

function unlockBodyScroll() {
	document.body.classList.remove('scroll-lock');
	document.body.style.paddingRight = '';
}



// Modal
const modal = document.querySelector('.modal');
const openModalBtns = document.querySelectorAll('.js-modal-open');
const closeModalBtn = document.querySelector('.js-modal-close');
let modalReturnFocus = null;

function openModal() {
	if (!modal) return;
	modalReturnFocus = document.activeElement;
	modal.classList.add('modal--active');
	modal.showModal();
	closeModalBtn?.focus({ preventScroll: true });
	lockBodyScroll();
}

function closeModal() {
	if (!modal) return;
	modal.close();
}

openModalBtns.forEach(button => button.addEventListener('click', event => {
	event.preventDefault();
	openModal();
}));
closeModalBtn?.addEventListener('click', closeModal);
modal?.addEventListener('close', () => {
	modal.classList.remove('modal--active');
	unlockBodyScroll();
	modalReturnFocus?.focus({ preventScroll: true });
});
modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });

window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && modal?.classList.contains('modal--active')) closeModal();
});



// Lightbox
(() => {
const lightbox = document.getElementById('lightbox');
if (!lightbox) return;
const prevBtn = lightbox.querySelector('.lightbox__arrow--prev');
const nextBtn = lightbox.querySelector('.lightbox__arrow--next');
const closeBtn = lightbox.querySelector('.lightbox__close');
// const caption = lightbox.querySelector('.lightbox__caption');
const lightboxOverlay = lightbox.querySelector('.lightbox__overlay');

const prevImg = lightbox.querySelector('.lightbox__image--prev');
const currentImg = lightbox.querySelector('.lightbox__image--current');
const nextImg = lightbox.querySelector('.lightbox__image--next');

const thumbnails = Array.from(document.querySelectorAll('.js-lightbox'));
let activeIndex = 0;
let lightboxReturnFocus = null;

function updateLightboxImages(index) {
	const prev = thumbnails[(index - 1 + thumbnails.length) % thumbnails.length];
	const current = thumbnails[index];
	const next = thumbnails[(index + 1) % thumbnails.length];

	prevImg.src = prev.dataset.highres;
	prevImg.alt = prev.alt || '';
	currentImg.src = current.dataset.highres;
	currentImg.alt = current.alt || '';
	nextImg.src = next.dataset.highres;
	nextImg.alt = next.alt || '';

	// caption.textContent = current.alt || '';
	activeIndex = index;
}

function showLightbox(index) {
	updateLightboxImages(index);
	lightboxReturnFocus = document.activeElement;
	lightbox.classList.add('lightbox--active');
	lightbox.showModal();
	closeBtn.focus({ preventScroll: true });
	lockBodyScroll();
}

function hideLightbox() {
	lightbox.close();
}

function showNext() {
	const newIndex = (activeIndex + 1) % thumbnails.length;
	updateLightboxImages(newIndex);
}

function showPrev() {
	const newIndex = (activeIndex - 1 + thumbnails.length) % thumbnails.length;
	updateLightboxImages(newIndex);
}

thumbnails.forEach((thumb, index) => {
	thumb.addEventListener('keydown', event => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			showLightbox(index);
		}
	});
	thumb.addEventListener('click', (e) => {
		e.preventDefault();
		showLightbox(index);
	});
});

lightbox.addEventListener('close', () => {
	lightbox.classList.remove('lightbox--active');
	unlockBodyScroll();
	lightboxReturnFocus?.focus({ preventScroll: true });
});
closeBtn.addEventListener('click', hideLightbox);
prevBtn.addEventListener('click', showPrev);
nextBtn.addEventListener('click', showNext);

window.addEventListener('keydown', (e) => {
	if (!lightbox.classList.contains('lightbox--active')) return;
	if (e.key === 'ArrowLeft') showPrev();
	if (e.key === 'ArrowRight') showNext();
	if (e.key === 'Escape') hideLightbox();
});

let touchStartX = 0;
let touchEndX = 0;
const swipeThreshold = 50;

lightbox.addEventListener('touchstart', (e) => {
	touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

lightbox.addEventListener('touchend', (e) => {
	touchEndX = e.changedTouches[0].screenX;
	const diff = touchEndX - touchStartX;
	if (Math.abs(diff) > swipeThreshold) {
		diff < 0 ? showNext() : showPrev();
	}
}, { passive: true });

lightboxOverlay.addEventListener('click', hideLightbox);
})();
