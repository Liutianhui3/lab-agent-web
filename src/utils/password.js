// 可打印 ASCII 字符（! 到 ~），排除空格、中文、控制字符及其他 Unicode 字符。
// (?![\s\S]) 保证严格匹配字符串末尾，避免 $ 接受末尾换行。
export const PASSWORD_PATTERN =
  /^(?=[!-~]{8,20}(?![\s\S]))(?=[!-~]*[A-Z])(?=[!-~]*[a-z])(?=[!-~]*[0-9])[!-~]+(?![\s\S])/

export const PASSWORD_HINT = '8–20 位，须包含大写字母、小写字母和数字；符号可选，不允许空格或中文'

/** 返回全部未满足的条件；保留原始输入，不自动 trim。 */
export function validatePassword(password) {
  if (typeof password !== 'string' || !password) {
    return { valid: false, errors: ['请输入密码'] }
  }
  const errors = []
  if (password.length < 8) errors.push('密码至少需要 8 位')
  if (password.length > 20) errors.push('密码不能超过 20 位')
  if (!/[A-Z]/.test(password)) errors.push('缺少大写字母')
  if (!/[a-z]/.test(password)) errors.push('缺少小写字母')
  if (!/[0-9]/.test(password)) errors.push('缺少数字')
  if (/\s/.test(password)) errors.push('密码不能包含空格或其他空白字符')
  if (/[^\x21-\x7e\s]/.test(password)) {
    errors.push('密码只能包含英文字母、数字和英文符号，不能包含中文等字符')
  }
  return { valid: errors.length === 0, errors }
}
