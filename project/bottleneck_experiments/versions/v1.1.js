import { section, text, imageUrl, subLabel, badge, table, criteriaGrid } from '../components/render.js';

export default {
  version: 'v1.1',
  title: 'AI Worker 역할 분리 및 SQS 도입',
  status: 'shipped',
  tags: ['SQS', 'Queue'],
  prev: '1.0',
  next: '2.0',

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        '하나의 프로세스로 동작하던 AI Worker를 역할에 따라 Main과 Worker로 분리하였습니다.',
        'Main은 Supabase Realtime을 통해 데이터를 수신한 뒤 Rule Engine에 따라 AI 처리가 필요한 작업을 SQS에 등록합니다.',
        'Worker는 SQS에서 작업을 가져와 OpenAI API를 호출해 LLM 처리를 수행하도록 구성하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v2/v2-diagram.png', 'v1.1 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text([
        '이전 부하 테스트에서 일정 수준 이상의 부하에서 시스템이 안정적으로 동작하지 못한다는 것을 확인했습니다. 그 이유를 요청의 유입이 단일 Worker의 처리 속도보다 빠르기 때문이라고 판단하였습니다.',
        '따라서 부하가 증가하더라도 요청을 안정적으로 수용할 수 있으며, Worker의 속도에 맞춰 작업을 처리할 수 있도록 Queue를 도입하였습니다.',
        '또한 별도의 관리나 직접 운영을 필요로 하지 않고도 안정적인 Queue를 제공하며, 이후 Worker의 수평 확장에도 자연스럽게 대응할 수 있다는 점을 고려하여 Queue로는 AWS의 <strong>SQS</strong>를 사용하였습니다.',
      ])}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text([
        'Queue 도입에 따른 성능 개선 효과를 검증하기 위해, 아키텍처를 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하 테스트를 수행하였습니다.',
        '또한 이전 실험보다 병목 발생 시점을 더욱 정확하게 확인하기 위해 CloudWatch Agent의 메트릭 수집 주기를 5분에서 1분으로 변경하였습니다.',
      ])}
      ${subLabel('테스트 상세', `
        ${badge('베이스라인 테스트', '<p class="body-text">단일 사용자가 사용한다는 가정 하에 기본 성능을 측정하였습니다.</p>')}
        ${badge('점진적 부하 테스트', '<p class="body-text">동시 사용자 수(VUs)를 10 → 30 → 50 → 100으로 단계적으로 증가시켰습니다.</p>')}
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '2.19', '2.73', '0%'] },
            { cells: ['2', '1.59', '1.72', '0%'] },
            { cells: ['3', '0.76', '0.78', '0%'] },
            { cells: ['4', '0.95', '0.98', '0%'] },
            { cells: ['5', '0.82', '0.90', '0%'] },
            { cells: ['6', '1.26', '1.51', '0%'] },
            { cells: ['7', '0.87', '0.98', '0%'] },
            { cells: ['8', '0.75', '0.75', '0%'] },
            { cells: ['9', '0.79', '0.82', '0%'] },
            { cells: ['10', '0.88', '0.92', '0%'] },
            { cells: ['평균 (2~10회)', '0.96', '1.04', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차는 Vercel cold start로 간주하여 제외하였습니다. 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${table({
          head: ['지표', '결과'],
          rows: [
            { cells: ['avg', '778ms'] },
            { cells: ['p95', '929ms'] },
            { cells: ['에러율', '0%'] },
            { cells: ['CPU max', '12.9%'], highlight: true },
            { cells: ['SQS Backlog', '지속적으로 증가'], highlight: true },
          ]
        })}
        ${imageUrl('../../assets/images/bottleneck_experiments/v2/v2-cpu-graph.png', 'CPU 사용률 그래프')}
        <p class="body-text" style="margin-top:16px;">부하가 증가함에 따라 SQS의 대기 메시지 수가 지속적으로 증가하였으며, 테스트 종료 시점에도 처리되지 않은 메시지가 남아 있는 것을 확인하였습니다.</p>
        ${imageUrl('../../assets/images/bottleneck_experiments/v2/v2-oldestmessage.png', 'SQS Oldest Message Age 그래프')}
      `)}
    `),

    // 05 판단
    section(5, '판단 및 이유', `
      ${text([
        'Queue 도입 이후에는 기존에 발생했던 CPU 포화나 EC2 인스턴스 장애가 발생하지 않았습니다.',
        '그러나 SQS에는 처리되지 않은 메시지가 지속적으로 누적되었으며, 가장 오래 대기한 메시지의 대기 시간도 계속 증가하였습니다.',
        '<strong>여전히 Worker의 처리 속도가 요청의 유입 속도를 따라가지 못하고 있으며</strong>, 현재 시스템의 한계가 <strong>Worker의 처리량</strong>에 있다고 판단하였습니다.',
      ])}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text('Worker의 수를 증가시켜 처리량을 개선하는 방향으로 개선 방향을 결정하였습니다.')}
    `),
  ]
};
