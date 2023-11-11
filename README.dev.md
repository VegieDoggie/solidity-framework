# solidity-framework

- `tsconfig.json`:

  - `"allowJs": true,` 开启: `chainlist/constants/extraRpcs.js`支持
  - `"resolveJsonModule": true,` 开启: json模块化
- `package.json`

  - `"node-fetch": "^2.7.0",` 兼容: `chainlist/constants/extraRpcs.js`的`node-fetch@2`支持
  - `"chalk": "^4.1.2"` 兼容: 兼容`ts-node`，否则无法被直接运行
