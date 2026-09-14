import {
  MAX_IMAGE_UPLOAD_BYTES,
  imageRejectionReason,
  uploadOutcomeAlert,
} from '../src/utils/imageUpload';
import { isValidEmail } from '../src/utils/validation';

describe('imageRejectionReason', () => {
  it('accepts an ordinary photo, including the picker\'s bogus image/jpg', () => {
    expect(imageRejectionReason({ uri: 'file://a.jpg', type: 'image/jpg', fileSize: 1024 })).toBeNull();
    expect(imageRejectionReason({ uri: 'file://a.png', type: 'image/png', fileSize: 1024 })).toBeNull();
  });

  it('names the format the API refuses instead of failing at upload time', () => {
    expect(imageRejectionReason({ uri: 'file://a.gif', type: 'image/gif', fileSize: 1024 }))
      .toMatch(/^GIF images are not supported/);
  });

  it('rejects a non-image outright', () => {
    expect(imageRejectionReason({ uri: 'file://a.pdf', type: 'application/pdf' }))
      .toMatch(/not an image/);
  });

  it('names the size and the ceiling when the file is too big', () => {
    const reason = imageRejectionReason({
      uri: 'file://big.jpg',
      type: 'image/jpeg',
      fileSize: MAX_IMAGE_UPLOAD_BYTES + 1,
    });
    expect(reason).toMatch(/5\.0 MB/);
    expect(reason).toMatch(/under 5 MB/);
  });

  it('lets an unknown type through for the server to judge', () => {
    expect(imageRejectionReason({ uri: 'file://a.avif', type: '', fileSize: 1024 })).toBeNull();
  });
});

describe('isValidEmail', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['jo bloggs@x.com', 'a@@b.com', 'user@host', 'user@host.c', '@x.com', 'plain'])(
    'rejects %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('uploadOutcomeAlert', () => {
  it('says nothing when every picked photo went up', () => {
    expect(uploadOutcomeAlert({ uploaded: 3, attempted: 3, skipped: [] })).toBeNull();
  });

  it('reports how far a part-succeeded batch got, with the server reason', () => {
    const alert = uploadOutcomeAlert({
      uploaded: 2,
      attempted: 5,
      skipped: [],
      failure: 'Maximum 3 images are allowed.',
    });
    expect(alert).toEqual({
      title: 'Some Photos Not Uploaded',
      message: '2 of 5 photos uploaded.\n\nMaximum 3 images are allowed.',
    });
  });

  it('does not count photos when none went up', () => {
    const alert = uploadOutcomeAlert({
      uploaded: 0,
      attempted: 2,
      skipped: [],
      failure: 'Maximum 3 images are allowed.',
    });
    expect(alert).toEqual({ title: 'Upload Failed', message: 'Maximum 3 images are allowed.' });
  });

  it('collapses one reason repeated across several skipped files', () => {
    const reason = 'GIF images are not supported. Please choose a JPEG, PNG or WebP photo.';
    const alert = uploadOutcomeAlert({ uploaded: 2, attempted: 2, skipped: [reason, reason] });
    expect(alert).toEqual({ title: 'Some Photos Skipped', message: reason });
  });

  it('reports a skip and a failure together', () => {
    const alert = uploadOutcomeAlert({
      uploaded: 1,
      attempted: 2,
      skipped: ['That image is 6.0 MB. Please choose one under 5 MB.'],
      failure: 'Maximum 3 images are allowed.',
    });
    expect(alert?.title).toBe('Some Photos Not Uploaded');
    expect(alert?.message).toBe(
      '1 of 2 photos uploaded.\n\nMaximum 3 images are allowed.\n\nThat image is 6.0 MB. Please choose one under 5 MB.',
    );
  });
});
