import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v5.0',
  title: '',
  status: 'in progress',
  tags: [],
  prev: '4.3',
  next: null,

  sections: [

    // 01 운영 환경 구성
    section(1, '운영 환경 구성', `
      ${text('4.3버전과 동일한 환경을 유지하였습니다.')}
    `),

    // 02 실험 설계
    section(2, '실험 설계', `
      ${text('')}
    `),

    // 03 실험 결과
    section(3, '실험 결과', `
      ${text('')}
    `),

    // 04 판단 및 이유
    section(4, '판단 및 이유', `
      ${text('')}
    `),

    // 05 개선 방향
    section(5, '개선 방향', `
      ${text('')}
    `),
  ]
};
