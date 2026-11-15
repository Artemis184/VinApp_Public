import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT || 'http://10.0.0.9:9000';
const bucket = process.env.S3_BUCKET || 'vinapp-images';
const publicBaseUrl = (process.env.S3_PUBLIC_URL || endpoint).replace(/\/$/, '');

const client = new S3Client({
  endpoint,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

export const uploadObject = async ({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> => {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${publicBaseUrl}/${bucket}/${key}`;
};

export const deleteObjectByUrl = async (value?: string | null): Promise<void> => {
  if (!value) return;

  try {
    const url = new URL(value);
    const bucketPrefix = `/${bucket}/`;
    const prefixIndex = url.pathname.indexOf(bucketPrefix);

    if (prefixIndex === -1) return;

    const key = decodeURIComponent(url.pathname.slice(prefixIndex + bucketPrefix.length));
    if (!key) return;

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.error('Error al eliminar objeto de MinIO:', error);
  }
};

export const getObjectStorageConfig = () => ({ endpoint, bucket, publicBaseUrl });
