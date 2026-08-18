import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v5.1',
  title: '',
  status: 'in progress',
  tags: [],
  prev: '5.0',
  next: null,

  sections: [

    // 01 운영 환경 구성
    section(1, '운영 환경 구성', `
      ${text('5.0버전에서 확인된 RDS Connection Capacity 문제를 개선하기 위해 DB Connection Pool 및 Task 수를 조정하였습니다. 최종 운영 환경은 다음과 같습니다.')}
      ${table({
        head: ['서비스', 'Task 수', 'Pool Max'],
        rows: [
          { cells: ['api-server', '1', '10'], numVal: true },
          { cells: ['rule-worker', '9', '4'], numVal: true },
          { cells: ['ai-worker', '9', '2'], numVal: true },
        ]
      })}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text('')}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('')}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${text('')}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text('')}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text('')}
    `),
  ]
};
