using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using TestApplication.Infrastructure.Interface;

namespace TestApplication.Application.Common.Services
{
    public class EncryptionService : IEncryptionService
    {
        private readonly byte[] _key;

        public EncryptionService(IConfiguration configuration)
        {
            var key = configuration["Encryption:Key"];
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new InvalidOperationException(
                    "Encryption:Key is missing from configuration.");
            }

            _key = Convert.FromBase64String(key);
        }

        public string Decrypt(string cipherText)
        {
            if (string.IsNullOrEmpty(cipherText))
                return cipherText;

            try
            {
                byte[] data = Convert.FromBase64String(cipherText);

                const int nonceSize = 12;
                const int tagSize = 16;

                if (data.Length < nonceSize + tagSize)
                    throw new CryptographicException(
                        "Invalid encrypted message.");

                byte[] nonce = data[..nonceSize];
                byte[] tag = data[
                    nonceSize..(nonceSize + tagSize)];

                byte[] ciphertext = data[
                    (nonceSize + tagSize)..];

                byte[] plaintext = new byte[ciphertext.Length];

                using var aes = new AesGcm(_key, 16);

                aes.Decrypt(
                    nonce,
                    ciphertext,
                    tag,
                    plaintext);

                return Encoding.UTF8.GetString(plaintext);
            }
            catch
            {
                // If Base64 decode or decrypt fails, assume it's plain text
                return cipherText;
            }
        }

        public string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText))
                return plainText;

            byte[] nonce = RandomNumberGenerator.GetBytes(12);
            byte[] plaintextBytes = Encoding.UTF8.GetBytes(plainText);

            byte[] ciphertext = new byte[plaintextBytes.Length];
            byte[] tag = new byte[16];

            using var aes = new AesGcm(_key, 16);

            aes.Encrypt(
                nonce,
                plaintextBytes,
                ciphertext,
                tag);

            // nonce + tag + ciphertext
            var result = new byte[
                nonce.Length +
                tag.Length +
                ciphertext.Length];

            Buffer.BlockCopy(
                nonce, 0,
                result, 0,
                nonce.Length);

            Buffer.BlockCopy(
                tag, 0,
                result, nonce.Length,
                tag.Length);

            Buffer.BlockCopy(
                ciphertext, 0,
                result,
                nonce.Length + tag.Length,
                ciphertext.Length);

            return Convert.ToBase64String(result);
        }
    }
}
