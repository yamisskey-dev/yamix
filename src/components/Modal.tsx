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

    return (
      <dialog ref={ref} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-base">{title}</h3>
          <p className="py-3 text-[13px] whitespace-pre-line">{body}</p>
          <div className="modal-action">
            <button className="btn btn-sm" onClick={handleClick}>
              {buttonText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClick}>close</button>
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

    return (
      <dialog ref={ref} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-base">{title}</h3>
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
          <button onClick={handleCancel}>close</button>
        </form>
      </dialog>
    );
  }
);

ConfirmModal.displayName = "ConfirmModal";
