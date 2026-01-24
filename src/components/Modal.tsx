"use client";

import { forwardRef } from "react";

interface ModalProps {
  title: string;
  body: string;
  buttonText: string;
  onClick?: () => void;
}

export const Modal = forwardRef<HTMLDialogElement, ModalProps>(
  ({ title, body, buttonText, onClick }, ref) => {
    const handleClick = () => {
      if (ref && "current" in ref && ref.current) {
        ref.current.close();
      }
      onClick?.();
    };

    const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <dialog ref={ref} className="modal" aria-labelledby={titleId}>
        <div className="modal-box">
          <h3 id={titleId} className="font-bold text-base">{title}</h3>
          <p className="py-3 text-[13px] whitespace-pre-line">{body}</p>
          <div className="modal-action">
            <button className="btn btn-sm" onClick={handleClick}>
              {buttonText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClick} tabIndex={-1}>close</button>
        </form>
      </dialog>
    );
  }
);

Modal.displayName = "Modal";

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmButtonClass?: string;
}

export const ConfirmModal = forwardRef<HTMLDialogElement, ConfirmModalProps>(
  (
    {
      title,
      body,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
      confirmButtonClass = "btn-error",
    },
    ref
  ) => {
    const handleConfirm = () => {
      if (ref && "current" in ref && ref.current) {
        ref.current.close();
      }
      onConfirm();
    };

    const handleCancel = () => {
      if (ref && "current" in ref && ref.current) {
        ref.current.close();
      }
      onCancel?.();
    };

    const titleId = `confirm-modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <dialog ref={ref} className="modal" aria-labelledby={titleId}>
        <div className="modal-box">
          <h3 id={titleId} className="font-bold text-base">{title}</h3>
          <p className="py-3 text-[13px] whitespace-pre-line">{body}</p>
          <div className="modal-action">
            <button className={`btn btn-sm ${confirmButtonClass}`} onClick={handleConfirm}>
              {confirmText}
            </button>
            <button className="btn btn-sm" onClick={handleCancel}>
              {cancelText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleCancel} tabIndex={-1}>close</button>
        </form>
      </dialog>
    );
  }
);

ConfirmModal.displayName = "ConfirmModal";
