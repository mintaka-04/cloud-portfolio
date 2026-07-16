import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip } from '../components/render.js';

export default {
  version: 'v3.1',
  title: '',
  status: 'in progress',
  tags: [],
  prev: '3.0',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        'Rule Worker에 Coroutine 기반 동시 처리와 ECS Auto Scaling을 적용하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-diagrm.png', 'v3.1 아키텍처 다이어그램')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-event-queue-visible.png', 'event-queue Approximate Number Of Messages Visible 그래프')}
      ${imageUrl('../../assets/images/bottleneck_experiments/v4/v4-rule-worker-cpu-memory-graph.png', 'rule-worker CPU/Memory 그래프')}
      <div style="margin-top:20px;">
        ${text([
          '적절한 처리량 증가방법을 고려하기 위해 이전 테스트의 CPU 사용량 그래프와 Backlog 그래프를 참고하였고, backlog는 계속 증가하는데 CPU 사용률은 최대 42.8%까지만 증가한 것을 확인할 수 있었습니다.',
          '이에따라 단일 rule-worker 프로세스의 처리에서 CPU의 연산보다는 I/O 대기 시간이 처리량에 영향을 주는 것으로 판단하였습니다.',
          '따라서 단일 rule-worker의 처리량을 늘리기 위해 Coroutine 기반 동시 처리를 적용하였으며, Queue의 적체량에 따라 worker 수를 자동으로 조절할 수 있도록 Auto Scaling을 적용하였습니다.',
        ])}
      </div>
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text([
        '테스트 시나리오와 사용 데이터는 이전과 동일하게 유지하였습니다.',
        '하지만 rule-worker에 autoscaling을 적용함에 따라 초기 설정이 필요했고, 이를 위해 Coroutine만 적용한 상태에서 rule-worker 1대의 처리량을 측정하였습니다. 이후 측정 결과를 바탕으로 autoscaling 초기 설정을 적용한 뒤 부하테스트를 수행하였습니다.',
      ])}
      ${subLabel('Auto Scaling 초기 설정', `
        ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-noautoscaling-notvisible.png', 'Auto Scaling 미적용 상태 Approximate Number Of Messages Not Visible 그래프')}
        <div style="margin-top:20px;">
          ${text([
            'rule-worker가 최대 처리 상태에 도달한 시점을 확인하기 위해 ApproximateNumberOfMessagesNotVisible 지표를 사용하였습니다. 해당 지표가 Coroutine의 최대 동시 처리 수인 10에 도달한 이후에는 지속적으로 높은 수준을 유지하였기 때문에 해당구간을 rule-worker의 최대 처리 상태를 안정적으로 유지하는 구간이라고 판단하였습니다.',
          ])}
        </div>
        ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-noautoscaling-deleted.png', 'Auto Scaling 미적용 상태 Approximate Number Of Messages Deleted 그래프')}
        <div style="margin-top:20px;">
          ${text([
            '안정적인 Auto Scaling 정책을 위해 해당 구간의 NumberOfMessagesDeleted 중 하위 20% 데이터만 사용하여 처리량을 계산하였습니다. 계산 결과 평균 204msg/분을 rule-worker 1개의 기준 처리량으로 설정하였습니다.',
          ])}
        </div>
        ${table({
          head: ['항목', '초기 설정'],
          rows: [
            { cells: ['Scale-out/in Threshold', '204/50'] },
            { cells: ['허용 시간', '30초'] },
            { cells: ['Scale-out/in Step', '+3 / -1'] },
            { cells: ['Min/Max Worker', '1/9'] },
            { cells: ['Scale-out/in Cooldown', '60초/120초'] },
          ]
        })}
        <div style="margin-top:20px;">
          ${text([
            'Scale-in Threshold는 불필요한 Scale-in이 반복되는 현상을 방지하기 위해 Scale-out Threshold의 약 50%로 설정하였습니다.',
            '허용시간은 Cloudwatch Metric의 60초 관측 주기를 Scale-out이 수행되기 전까지 Backlog가 과도하게 증가하지 않도록 설정하였으며, Max Worker는 최대 유입 기준으로, Min Worker는 최소 동작을 보장하기 위해 설정하였습니다.',
            '또한 Scale-out Step은 Scale-out 이후 Cooldown 동안 Backlog가 허용 가능한 수준을 초과하지 않도록 계산하여 +3으로 설정하였으며, Scale-in Step은 급격한 축소를 방지하기 위해 -1로 설정하였습니다.',
          ])}
        </div>
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '2.12', '3.12', '0%'] },
            { cells: ['2', '1.00', '1.18', '0%'] },
            { cells: ['3', '1.00', '1.15', '0%'] },
            { cells: ['4', '1.00', '1.22', '0%'] },
            { cells: ['5', '1.09', '1.15', '0%'] },
            { cells: ['6', '0.89', '0.95', '0%'] },
            { cells: ['7', '0.90', '0.98', '0%'] },
            { cells: ['8', '0.92', '1.01', '0%'] },
            { cells: ['9', '0.91', '1.00', '0%'] },
            { cells: ['10', '1.00', '1.02', '0%'] },
            { cells: ['평균 (2~10회)', '0.97', '1.07', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('k6 지표', `
          ${table({
            head: ['VU', 'avg (s)', 'p95 (s)', '상태'],
            rows: [
              { cells: ['10', '1.14', '1.79', '안정'] },
              { cells: ['30', '1.21', '2.15', '임계'] },
              { cells: ['50', '2.66', '6.97', '한계'] },
              { cells: ['100', '7.52', '23.37', '한계 초과'] },
            ]
          })}
          <p class="body-text" style="margin-top:12px;">VU가 증가함에 따라 50VU부터 응답 시간이 급격히 증가하였으며, 100VU에서는 한계점을 초과하였습니다.</p>
        `, 28)}
        ${badge('rule-worker 관련 cloudwatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-rule-worker-cpu.png', 'rule-worker CPU 그래프')}
          <p class="body-text" style="margin-top:12px;">rule-worker에서 CPU 사용률은 최대 57.6%까지 사용되었으며 이후 감소하였습니다.</p>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-rule-worker-visible.png', 'rule-worker 관련 Approximate Number Of Messages Visible 그래프')}
          </div>
        `, 28)}
      `)}
    `),
  ]
};
