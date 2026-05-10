/**
 * 腾讯云人脸识别（IAI）服务
 * 封装人员库管理、人脸注册、人脸搜索等功能
 */

import * as tencentcloud from 'tencentcloud-sdk-nodejs-iai';

const IaiClient = tencentcloud.iai.v20200303.Client;

/** 人脸搜索匹配阈值，低于此分数视为不匹配 */
const MATCH_THRESHOLD = 80;

function getIaiClient() {
  const SecretId = process.env.SecretId;
  const SecretKey = process.env.SecretKey;
  const Region = process.env.TENCENT_IAI_REGION || 'ap-shanghai';

  if (!SecretId || !SecretKey) {
    throw new Error('腾讯云 SecretId 或 SecretKey 未配置');
  }

  return new IaiClient({ credential: { secretId: SecretId, secretKey: SecretKey }, region: Region });
}

function getGroupId(): string {
  const groupId = process.env.FACE_GROUP_ID;
  if (!groupId) {
    throw new Error('FACE_GROUP_ID 未配置，请在 .env 中设置腾讯云人员库 GroupId');
  }
  return groupId;
}

/**
 * 创建人员并注册人脸
 * @param personId 人员ID，格式 user_${userId}
 * @param personName 人员名称（用户昵称）
 * @param imageBase64 人脸图片 base64 数据（不含 data:image/... 前缀）
 */
export async function createPerson(personId: string, personName: string, imageBase64: string): Promise<void> {
  const client = getIaiClient();
  const GroupId = getGroupId();

  await client.CreatePerson({
    GroupId,
    PersonId: personId,
    PersonName: personName,
    Image: imageBase64,
    QualityControl: 3,
    NeedRotateDetection: 1,
  });
}

/**
 * 在人员库中搜索匹配的人脸
 * @param imageBase64 待识别的人脸图片 base64
 * @returns 匹配结果 { personId, score } 或 null
 */
export async function searchFaces(
  imageBase64: string,
): Promise<{ personId: string; score: number } | null> {
  const client = getIaiClient();
  const GroupId = getGroupId();

  const res = await client.SearchFaces({
    GroupIds: [GroupId],
    Image: imageBase64,
    MaxFaceNum: 1,
    MaxPersonNum: 1,
    QualityControl: 1,
    NeedRotateDetection: 1,
  });

  const candidates = res.Results?.[0]?.Candidates;
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const best = candidates[0];
  if (!best || !best.PersonId || best.Score == null || best.Score < MATCH_THRESHOLD) {
    return null;
  }

  return { personId: best.PersonId, score: best.Score };
}

/**
 * 删除人员
 */
export async function deletePerson(personId: string): Promise<void> {
  const client = getIaiClient();

  await client.DeletePerson({ PersonId: personId });
}

/**
 * 根据用户 ID 生成腾讯云 PersonId
 */
export function toPersonId(userId: number): string {
  return `user_${userId}`;
}

/**
 * 从 PersonId 中解析用户 ID
 */
export function fromPersonId(personId: string): number | null {
  const match = personId.match(/^user_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
