/**
 * contact.js — Contact form validation and handling
 */

export function initContact() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', handleContactSubmit);
}

/**
 * Handle contact form submission
 */
function handleContactSubmit(e) {
    e.preventDefault();

    // Validate form
    if (!validateForm(this)) {
        return;
    }

    // Collect form data
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);

    // Create mailto link
    const subject = encodeURIComponent(data.subject);
    const body = encodeURIComponent(`Name: ${data.name}\n\n${data.message}`);
    const mailtoLink = `mailto:vigneshsl.career@gmail.com?subject=${subject}&body=${body}`;

    // Show success message
    showFormMessage('Thank you! Opening your email client...', 'success');

    // Open email client
    window.location.href = mailtoLink;

    // Reset form
    setTimeout(() => {
        this.reset();
        clearFormMessage();
    }, 1000);
}

/**
 * Validate form fields
 */
function validateForm(form) {
    let isValid = true;
    const fields = form.querySelectorAll('[required]');

    fields.forEach(field => {
        const error = validateField(field);
        if (error) {
            isValid = false;
            showFieldError(field, error);
        } else {
            clearFieldError(field);
        }
    });

    return isValid;
}

/**
 * Validate individual field
 */
function validateField(field) {
    const value = field.value.trim();
    const type = field.type;

    if (!value) {
        return 'This field is required';
    }

    if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
    }

    if (field.minLength && value.length < field.minLength) {
        return `Minimum ${field.minLength} characters required`;
    }

    if (field.maxLength && value.length > field.maxLength) {
        return `Maximum ${field.maxLength} characters allowed`;
    }

    return null;
}

/**
 * Show field error
 */
function showFieldError(field, message) {
    field.classList.add('is-invalid');
    const errorEl = field.form.querySelector(`[data-for="${field.id}"]`);
    if (errorEl) {
        errorEl.textContent = message;
    }
}

/**
 * Clear field error
 */
function clearFieldError(field) {
    field.classList.remove('is-invalid');
    const errorEl = field.form.querySelector(`[data-for="${field.id}"]`);
    if (errorEl) {
        errorEl.textContent = '';
    }
}

/**
 * Show form message
 */
function showFormMessage(message, type = 'info') {
    const form = document.getElementById('contactForm');
    const noteEl = form?.querySelector('#formNote');
    if (noteEl) {
        noteEl.textContent = message;
        noteEl.className = `form-note form-note--${type}`;
    }
}

/**
 * Clear form message
 */
function clearFormMessage() {
    const form = document.getElementById('contactForm');
    const noteEl = form?.querySelector('#formNote');
    if (noteEl) {
        noteEl.textContent = '';
        noteEl.className = 'form-note';
    }
}
