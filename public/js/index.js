const cards = document.querySelectorAll(".card");

cards.forEach(card => {

    card.addEventListener("mousemove", e => {

        const rect = card.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.background = `
        radial-gradient(circle at ${x}px ${y}px,
        rgba(168,85,247,.18),
        rgba(18,7,31,.9))
        `;
    });

    card.addEventListener("mouseleave", () => {
        card.style.background = "rgba(18,7,31,.7)";
    });

});

/* =========================
   AUTH MODAL
========================= */

const authModal = document.getElementById("authModal");

const loginPanel = document.querySelector(".login-panel");
const registerPanel = document.querySelector(".register-panel");

const openLoginBtns = document.querySelectorAll(".open-login");
const openRegisterBtns = document.querySelectorAll(".open-register");

openLoginBtns.forEach(btn => {

    btn.addEventListener("click", () => {

        authModal.classList.add("active");

        loginPanel.classList.add("active");
        registerPanel.classList.remove("active");

    });

});

openRegisterBtns.forEach(btn => {

    btn.addEventListener("click", () => {

        authModal.classList.add("active");

        registerPanel.classList.add("active");
        loginPanel.classList.remove("active");

    });

});

/* SWAP FORMS */

document.getElementById("showRegister")
    .addEventListener("click", (e) => {

        e.preventDefault();

        loginPanel.classList.remove("active");
        registerPanel.classList.add("active");

    });

document.getElementById("showLogin")
    .addEventListener("click", (e) => {

        e.preventDefault();

        registerPanel.classList.remove("active");
        loginPanel.classList.add("active");

    });

/* =========================
   INFO DIALOGS
========================= */

const dialogTriggers = document.querySelectorAll("[data-dialog]");

dialogTriggers.forEach(trigger => {

    trigger.addEventListener("click", (e) => {

        e.preventDefault();

        const target = trigger.dataset.dialog;

        document
            .getElementById(target)
            .classList.add("active");

    });

});

/* =========================
   CLOSE MODALS
========================= */

const modals = document.querySelectorAll(".modal");
const closeButtons = document.querySelectorAll(".close-modal");

closeButtons.forEach(btn => {

    btn.addEventListener("click", () => {

        modals.forEach(modal => {
            modal.classList.remove("active");
        });

    });

});

modals.forEach(modal => {

    modal.addEventListener("click", (e) => {

        if (e.target === modal) {
            modal.classList.remove("active");
        }

    });

});

/* ESC KEY */

document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {

        modals.forEach(modal => {
            modal.classList.remove("active");
        });

    }

});