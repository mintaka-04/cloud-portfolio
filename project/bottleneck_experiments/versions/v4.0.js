import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v4.0',
  title: 'TODO: 제목을 작성해주세요.',
  status: 'in progress',
  tags: [],
  prev: '3.2',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text('TODO: 아키텍처를 작성해주세요.')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text('TODO: 개선 배경을 작성해주세요.')}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('TODO: 실험 설계를 작성해주세요.')}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${text('TODO: 실험 결과를 작성해주세요.')}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text('TODO: 판단 및 이유를 작성해주세요.')}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text('TODO: 개선 방향을 작성해주세요.')}
    `),
  ]
};
