import {
  MAX_CERTIFICATE_BYTES,
  certificateSubmitError,
  checkCertificate,
} from '../src/utils/certificateUpload';

const MB = 1024 * 1024;

describe('checkCertificate', () => {
  it('accepts a PDF from the Files picker', () => {
    const check = checkCertificate({
      uri: 'file:///tmp/Diploma.pdf', name: 'Diploma.pdf', type: 'application/pdf', size: 2 * MB,
    });
    expect(check).toEqual({
      ok: true,
      file: { uri: 'file:///tmp/Diploma.pdf', name: 'Diploma.pdf', type: 'application/pdf', size: 2 * MB },
    });
  });

  it('sends a photo as image/jpeg under a .jpg name', () => {
    // The image picker reports JPEGs as the non-standard image/jpg, which the
    // server refuses; the name used to be certificate.pdf for every upload.
    const check = checkCertificate({
      uri: 'file:///tmp/IMG_0042.JPEG', name: 'IMG_0042.JPEG', type: 'image/jpg', size: MB,
    });
    expect(check.ok && check.file).toMatchObject({ name: 'IMG_0042.jpg', type: 'image/jpeg' });
  });

  it('falls back to the extension when the picker gives no type', () => {
    const check = checkCertificate({ uri: 'content://x/1', name: 'scan.png', type: null, size: null });
    expect(check.ok && check.file).toMatchObject({ name: 'scan.png', type: 'image/png', size: null });
  });

  it('names a file that came without a name', () => {
    const check = checkCertificate({ uri: 'content://x/2', name: null, type: 'application/pdf' });
    expect(check.ok && check.file.name).toBe('certificate.pdf');
  });

  it.each([
    ['GIF', { name: 'award.gif', type: 'image/gif' }],
    ['HEIC', { name: 'IMG_1.HEIC', type: 'image/heic' }],
    ['MP4', { name: 'clip.mp4', type: 'video/mp4' }],
    ['DOCX', { name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
  ])('refuses %s with a reason naming it', (label, picked) => {
    const check = checkCertificate({ uri: 'file:///tmp/f', size: MB, ...picked });
    expect(check).toEqual({
      ok: false,
      reason: `${label} files aren't supported. Please choose a PDF, JPG or PNG.`,
    });
  });

  it('refuses a file of unknown type without a meaningless label', () => {
    const check = checkCertificate({ uri: 'file:///tmp/blob', name: 'blob', type: '' });
    expect(check).toEqual({
      ok: false,
      reason: "That file type isn't supported. Please choose a PDF, JPG or PNG.",
    });
  });

  it('refuses a file over the size limit, saying how big it is', () => {
    const check = checkCertificate({
      uri: 'file:///tmp/big.pdf', name: 'big.pdf', type: 'application/pdf', size: 12.4 * MB,
    });
    expect(check).toEqual({
      ok: false,
      reason: 'That file is 12.4 MB. Please choose one under 10 MB.',
    });
  });

  it('lets a file of exactly the limit through', () => {
    const check = checkCertificate({
      uri: 'file:///tmp/max.pdf', name: 'max.pdf', type: 'application/pdf', size: MAX_CERTIFICATE_BYTES,
    });
    expect(check.ok).toBe(true);
  });

  it('refuses a pick with no uri', () => {
    expect(checkCertificate({ uri: null, name: 'a.pdf', type: 'application/pdf' }).ok).toBe(false);
  });
});

describe('certificateSubmitError', () => {
  const failed = (status: number, data: unknown) => ({ response: { status, data } });

  it("rewords the server's type refusal", () => {
    // Verbatim from POST /dating/spiritual-request, 2026-09-17
    const err = failed(400, {
      success: false,
      message: "Document type 'image/gif' is not allowed. Accepted: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document.",
      errors: null,
    });
    expect(certificateSubmitError(err)).toBe(
      "GIF files aren't supported. Please choose a PDF, JPG or PNG.",
    );
  });

  it("explains the host's 413 instead of echoing its page text", () => {
    const err = failed(413, 'The page was not displayed because the request entity is too large.');
    expect(certificateSubmitError(err)).toBe(
      'That file is too large to upload. Please choose one under 10 MB.',
    );
  });

  it('passes any other server reason through', () => {
    const err = failed(400, { success: false, message: 'You already have a pending request.' });
    expect(certificateSubmitError(err)).toBe('You already have a pending request.');
  });

  it('falls back to a screen-specific message', () => {
    expect(certificateSubmitError(failed(400, { success: false }))).toBe(
      'Could not submit your document. Please try again.',
    );
  });

  it('reports a lost connection as such', () => {
    expect(certificateSubmitError(new Error('Network Error'))).toMatch(/Unable to reach the server/);
  });
});
