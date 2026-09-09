// CompressX Profile Page Logic

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userRes = await apiFetch('/api/auth/me');
        const user = userRes.user;

        const navUserEmail = document.getElementById('nav-user-email');
        if (navUserEmail) navUserEmail.textContent = user.email;

        const profNameInput = document.getElementById('prof-name');
        if (profNameInput) profNameInput.value = user.name;

        const profEmailInput = document.getElementById('prof-email');
        if (profEmailInput) profEmailInput.value = user.email;

        const profCreatedEl = document.getElementById('prof-created');
        if (profCreatedEl) profCreatedEl.textContent = new Date(user.created_at).toLocaleDateString();

        const authTypeEl = document.getElementById('prof-auth-type');
        if (authTypeEl) {
            authTypeEl.textContent = 'Standard Account';
        }

        const avatarBox = document.getElementById('prof-avatar-box');
        if (avatarBox) {
            if (user.profile_image) {
                avatarBox.innerHTML = `<img src="${user.profile_image}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`;
            } else {
                avatarBox.innerHTML = `<div style="width:100px;height:100px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:700;">${user.name.charAt(0).toUpperCase()}</div>`;
            }
        }
    } catch(e) {}
});
