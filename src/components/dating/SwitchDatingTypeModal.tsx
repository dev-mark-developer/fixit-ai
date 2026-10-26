import React from 'react';
import AppAlert from '../common/AppAlert';
import { useAuth } from '../../store/AuthContext';
import { confirmDeleteForever } from '../../utils/deleteAccount';
import type { DatingType } from '../../store/ModuleStatusContext';

interface Props {
  /** The type being switched TO; null keeps the modal hidden. */
  target: DatingType | null;
  onClose: () => void;
}

/**
 * Switching dating type — either direction — is a re-registration: the
 * account is deleted and the user signs up fresh. This modal owns that
 * warning, shared by the dating drawer and the lobby cards.
 *
 * First step is an app-styled AppAlert (Cancel / Continue), the final one a
 * native alert that performs the deletion and signs the user out.
 */
export default function SwitchDatingTypeModal({ target, onClose }: Props) {
  const { logout } = useAuth();

  const targetLabel = target === 'Spiritual' ? 'Spiritual Dating' : 'Non-Spiritual Dating';

  const message =
    `Switching to ${targetLabel} means registering again with a fresh account.\n\n` +
    'Your current account and everything on it — profile, matches, chats and likes — ' +
    'will be permanently deleted.\n\n' +
    'An active subscription will not transfer to the new account either; ' +
    `you would need to purchase the subscription offered in ${targetLabel}.`;

  return (
    <AppAlert
      visible={target !== null}
      title={`Switch to ${targetLabel}`}
      message={message}
      onClose={onClose}
      buttons={[
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // iOS can't present the native alert while the RN modal is still
            // dismissing (same constraint as blockReportMenu) — give the
            // fade-out time to finish first.
            setTimeout(() => {
              confirmDeleteForever(
                logout,
                'Your current account and all its data will be permanently ' +
                  'deleted so you can register again. This cannot be undone.',
              );
            }, 450);
          },
        },
      ]}
    />
  );
}
