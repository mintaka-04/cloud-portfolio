import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v4.1',
  title: 'OpenAI Rate Limit 대응 및 Auto Scaling 정책 개선',
  status: 'in progress',
  tags: ['OpenAI Rate Limit', 'Concurrency', 'Auto Scaling'],
  prev: '4.0',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text('AI-worker에 OpenAI Rate Limit 대응을 위한 Retry 및 Concurrency 제어를 적용하고, rule-worker에 CPU Utilization 기반 Auto Scaling 정책을 추가하였습니다.')}
      ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-diagram.png', 'v4.1 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${text([
        '이전 부하 테스트에서 AI-worker의 task 수를 늘려도 처리량이 증가하지 않고, CloudWatch Logs Insights 분석 결과 OpenAI API의 Rate Limit이 처리량을 제한하는 주요 원인이라는 것을 확인했습니다. 이에 따라 OpenAI API의 사용량을 보다 안정적으로 제어하기 위해 ai-worker에 Semaphore 기반 Concurrency 제어와 Rate Limit 발생 시 Retry 정책을 적용하였습니다.',
        '또한 Rule-worker는 CPU Utilization이 100%에 근접했는데도 SQS Visible Message 기반 Auto Scaling 정책으로 인해 Scale-out이 늦게 수행되는 문제도 확인했습니다. 따라서 초기 부하 대응을 개선하기 위해 CPU Utilization 기반 Auto Scaling 정책을 추가하였습니다.',
      ])}
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('이번 버전에서 적용한 Concurrency 제어 및 Retry 정책, CPU Utilization 기반 Auto Scaling 정책을 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하테스트를 수행하였습니다.')}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.83', '2.92', '0%'] },
            { cells: ['2', '1.33', '2.04', '0%'] },
            { cells: ['3', '1.02', '1.46', '0%'] },
            { cells: ['4', '1.08', '1.49', '0%'] },
            { cells: ['5', '0.93', '1.03', '0%'] },
            { cells: ['6', '0.89', '0.98', '0%'] },
            { cells: ['7', '1.10', '1.55', '0%'] },
            { cells: ['8', '1.09', '1.52', '0%'] },
            { cells: ['9', '1.08', '1.50', '0%'] },
            { cells: ['10', '0.92', '1.18', '0%'] },
            { cells: ['평균 (3~10회)', '1.01', '1.34', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1~2회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 3~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '0.84'] },
              { cells: ['p95', '1.25'] },
              { cells: ['에러율', '0%'] },
            ]
          })}
          <div style="margin-top:20px;">
            ${table({
              head: ['VU', 'avg', 'p95', '상태'],
              rows: [
                { cells: ['0→10', '1.01', '1.74', '안정'] },
                { cells: ['10', '0.91', '1.58', '안정'] },
                { cells: ['30', '0.84', '1.34', '안정'] },
                { cells: ['50', '0.83', '1.21', '안정'] },
                { cells: ['100', '0.83', '1.21', '안정'] },
              ]
            })}
          </div>
          <p class="body-text" style="margin-top:12px;">전 구간에서 안정상태로 확인되었습니다.</p>
        `)}
        ${badge('event-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-event-queue-sent-deleted.png', 'event-queue Sent/Deleted 그래프')}
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-event-queue-oldest.png', 'event-queue Approximate Age Of Oldest Message 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-event-queue-task-count.png', 'event-queue Task Count 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">Event-Queue는 이전 버전과 유사한 양상을 보였습니다. 50VU 구간까지 Number Of Messages Sent와 Number Of Messages Deleted가 거의 동일하게 유지되었으며, 100VU 구간부터 두 지표 간 격차가 발생하였습니다. 또한 Live Task Count는 테스트 종료 시점에 가까워져서야 증가하는 것을 확인하였습니다.</p>
        `)}
        ${badge('rule-worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-rule-worker-cpu-memory.png', 'rule-worker CPU/Memory 그래프')}
          <p class="body-text" style="margin-top:12px;">Rule-worker 역시 이전 버전과 유사한 양상을 보였습니다. CPU Utilization은 VU 증가에 따라 단계적으로 상승하였으며, 100VU 구간에서는 100%에 근접하는 것을 확인하였습니다.</p>
        `)}
        ${badge('ai-queue', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-ai-queue-sent-deleted.png', 'ai-queue Sent/Deleted 그래프')}
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-ai-queue-oldest.png', 'ai-queue Approximate Age Of Oldest Message 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-ai-queue-visible.png', 'ai-queue Approximate Number Of Messages Visible 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-ai-queue-task-count.png', 'ai-queue Task Count 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">AI-Queue도 이전 버전과 유사한 양상을 보였습니다. 부하가 지속됨에 따라 Number Of Messages Sent와 Number Of Messages Deleted 간 격차가 지속적으로 확대되는 것을 확인하였습니다. 또한 Approximate Age Of Oldest Message는 최대 8.2분까지 증가하였으며, Approximate Number Of Messages Visible는 최대 10,732건까지 증가하였습니다. Live Task Count는 4개, 7개, 10개로 단계적으로 확장되는 것을 확인하였습니다.</p>
        `)}
        ${badge('ai-worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-ai-worker-cpu-memory.png', 'ai-worker CPU/Memory 그래프')}
          <p class="body-text" style="margin-top:12px;">CPU Utilization은 최대 56.3% 수준에 머무르는 것으로 확인되었습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${subLabel('분석 1 : Rule-worker Auto Scaling', `
        ${text([
          'CPU Utilization 기반 Auto Scaling 정책을 추가하였음에도 이전 버전과 유사한 결과를 확인하였습니다. CPU Utilization은 70%를 초과한 이후에도 상당 시간 동안 Task 수가 1개로 유지되었으며, 100VU 구간에서는 다시 100%에 근접하였습니다. 또한 실제 Scale-out은 테스트 종료 시점에 가까워져서야 수행되었습니다.',
          '이를 통해 CPU 기반 Auto Scaling 정책만 추가하는 것으로는 부하에 대한 처리 효과를 기대했던만큼 얻기 어렵다는 것을 확인했습니다.',
        ])}
      `)}
      ${subLabel('분석 2 : 동시성 제어 효과', `
        ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-rpd-tpm-rpm.png', 'OpenAI RPD/TPM/RPM 사용량 그래프')}
        <div style="margin-top:20px;">
          ${text([
            'CloudWatch Logs Insights 분석 결과 OpenAI Rate Limit 발생 건수가 크게 감소한 것을 확인하였습니다. TPM은 1,522건에서 24건, RPM은 1,184건에서 19건으로 감소하여 Semaphore 기반 동시성 제어와 Retry 정책이 API 사용량을 효과적으로 제어한 것으로 판단하였습니다.',
            '반면 RPD는 46건 발생하였으며, 이는 현재 OpenAI Tier의 일일 요청량 제한에 따른 것으로 애플리케이션 수준에서 해결하기 어려운 외부 제약이라는 것을 확인하였습니다.',
          ])}
        </div>
      `)}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text([
        'Semaphore 기반 동시성 제어와 Retry 정책을 통해 OpenAI API의 순간적인 Rate Limit은 효과적으로 완화할 수 있었습니다. 그러나 OpenAI Tier의 사용량 제한으로 인해 Rate Limit은 여전히 발생하였으며, 추가적인 처리량 향상에는 한계가 있음을 확인하였습니다. 하지만 비용을 고려하여 OpenAI Tier 업그레이드는 수행하지 않기로 했습니다.',
        '또한 Rule-worker는 CPU 기반 Auto Scaling 정책만으로는 기대했던 수준의 초기 부하 대응 효과를 확인하지 못하였으므로, Auto Scaling 정책에 대한 추가적인 검토를 진행하기로 결정했습니다.',
      ])}
    `),
  ]
};
