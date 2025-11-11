# ECHONET Lite.js ユニットテスト

このディレクトリには、echonet-lite.jsライブラリのユニットテストが含まれています。

## セットアップ

```bash
cd unitTest
npm install
```

## テストの実行

### 全テストを実行
```bash
npm test
```

### ウォッチモードで実行（ファイル変更時に自動再実行）
```bash
npm run test:watch
```

### カバレッジレポートを生成
```bash
npm run test:coverage
```

## テスト構成

- `el.test.js` - ECHONET Lite プロトコルの主要機能のテスト
  - 変換系関数（toHexString, toHexArray, bytesToString）
  - パース関数（parseString, parseBytes, parseDetail）
  - クラスリスト生成
  - ELDATA変換
  - プロパティマップ形式2のパース
  - オブジェクトソート
  - 定数の確認

## テストの追加

新しいテストを追加する場合は、`*.test.js`という命名規則に従ってファイルを作成してください。

## 注意事項

- ネットワーク通信を伴うテストは、モックを使用して実装する必要があります
- 実際のECHONET Lite機器との通信テストは統合テストとして別途実施してください
