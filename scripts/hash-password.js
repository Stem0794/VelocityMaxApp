import { createHash, randomBytes } from 'crypto';

const arg = process.argv[2];

if (!arg || arg === '--generate') {
  // Generate a strong random password if none provided
  const password = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(password).digest('hex');
  console.log('\nGenerated password:', password);
  console.log('SHA-256 hash:      ', hash);
  console.log('\nStore the password somewhere safe (password manager).');
  console.log('Add the hash as VITE_APP_PASSWORD_HASH in GitHub Secrets → Actions.\n');
} else {
  const hash = createHash('sha256').update(arg).digest('hex');
  console.log('\nSHA-256 hash:', hash);
  console.log('\nAdd this as VITE_APP_PASSWORD_HASH in GitHub Secrets → Actions.\n');
}
