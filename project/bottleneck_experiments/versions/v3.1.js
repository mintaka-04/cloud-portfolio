import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v3.1',
  title: 'Rule-worker Coroutine 적용 및 Auto Scaling 도입',
  status: 'in progress',
  tags: ['Coroutine', 'Auto Scaling', 'DB Connection Pool'],
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
          <div style="margin-top:20px;">
            ${table({
              head: ['rule-worker task 수', '시간', 'VU 구간'],
              rows: [
                { cells: ['1', '시작 ~ 9분', '10 → 30 VUs'] },
                { cells: ['4', '9분 ~ 12분', '30VUs 유지'] },
                { cells: ['7', '12분 ~ 15분', '50VUs 유지'] },
                { cells: ['9', '15분 ~ 종료 (17분)', '100VUs 유지'] },
              ]
            })}
            <div style="margin-top:20px;">
              ${text([
                'AutoScaling이 부하 증가에 따라 정상적으로 동작해 rule-worker task 수가 최대 9까지 증가했습니다.',
                '하지만 ApproximateNumberOfMessagesVisible는 테스트 후반부까지 지속적으로 증가하며 Backlog가 누적되었습니다.',
              ])}
            </div>
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-rule-worker-deleted.png', 'rule-worker 관련 Approximate Number Of Messages Deleted 그래프')}
            <div style="margin-top:20px;">
              ${text([
                'NumberOfMessagesDeleted는 100VU 구간에서 감소하는 경향을 보였으며 테스트 시간 내(~17분)의 최대값은 233건/분으로 확인되었습니다.',
                '또한 테스트 종료 이후 처리량이 빠르게 회복되는 것을 확인했습니다.',
              ])}
            </div>
          </div>
        `, 28)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text([
        'Rule-worker task수 변화와 NumberOfMessagesDeleted 그래프를 통해 task 개수가 증가했는데도 처리량이 증가하지 않았다는 것을 확인했습니다. 따라서 처리량 증가를 제한하는 원인을 파악하기 위해 테스트 결과를 추가적으로 분석하였습니다.',
      ])}
      ${subLabel('분석 1 : 베이스라인과 처리량 비교', `
        <div class="image-grid">
          <div>
            ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-noautoscaling-deleted.png', 'Auto Scaling 미적용 상태 Approximate Number Of Messages Deleted 그래프')}
            <p class="body-text" style="margin-top:8px; text-align:center;">(베이스라인 테스트 결과)</p>
          </div>
          <div>
            ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-rule-worker-deleted.png', 'rule-worker 관련 Approximate Number Of Messages Deleted 그래프')}
            <p class="body-text" style="margin-top:8px; text-align:center;">(점진적 부하 테스트 결과)</p>
          </div>
        </div>
        <div style="margin-top:20px;">
          ${text([
            'NumberOfMessagesDeleted 그래프에서 단일 rule-worker였던 베이스라인 테스트 결과 최대 274msg/분의 처리량을 확인할 수 있었습니다.',
            '하지만 점진적 부하 테스트에서는 rule-worker에 autoscaling이 적용되어 최대 task가 9개까지 증가했음에도 테스트 중 최대 처리량은 233건/분이었으며, 100VU 구간에서는 오히려 감소하는 경향이 나타났습니다. 그리고 테스트 종료 이후에 처리량이 다시 273건/분 정도로 회복되었습니다.',
            '즉, Rule-worker의 task 수는 증가했지만 처리량은 이에 비례하여 증가하지 않았다는 것을 확인할 수 있었습니다.',
          ])}
        </div>
      `)}
      ${subLabel('분석 2 : CPU, Memory 사용률', `
        ${text([
          '대체적으로 CPU, memory 사용률이 낮게 유지되었으며 오히려 부하 구간에서는 CPU 사용률이 감소하는 비정상적인 패턴이 발생했습니다. 따라서 CPU 연산보다는 <strong>외부 자원에 대한 대기 시간</strong>이 처리량을 제한하고 있을 가능성이 있다고 판단했습니다.',
        ])}
      `)}
      ${subLabel('분석 3 : 부하 종료 후 처리량 즉시 회복', `
        ${text([
          '테스트 종료 이후 worker 수는 그대로 유지되었지만 처리량이 급격히 증가하였습니다. 해당 구간에서 task수는 9로 유지되고 있었으며, 종료 시점 변동된 사항은 테스트의 종료, 즉 API 호출의 종료 이외에는 없었습니다.',
          '따라서 API 요청이 발생하는 부하 상황에서는 rule-worker가 <strong>API 서버와 공유하는 자원</strong>에 대한 대기 시간이 증가하여 처리량이 제한된 것으로 판단하였습니다.',
        ])}
      `)}
      ${subLabel('분석 4 : connection pool timeout 에러 확인', `
        ${text([
          'CloudWatch의 로그에서 다음의 에러 로그를 확인했습니다.',
        ])}
        ${note(`{'message': 'Timed out acquiring connection from connection pool.', 'code': 'PGRST003', 'hint': None, 'details': None}`)}
        <div style="margin-top:16px; border-left:3px solid var(--accent); padding:12px 16px; font-size:13.5px; color:var(--ink-soft); font-style:italic; line-height:1.6;">
          PGRST003 : The request timed out waiting for a connection from PostgREST's internal pool
          <div style="margin-top:6px; font-style:normal; font-size:12px;">— Supabase 공식 문서</div>
        </div>
        <div style="margin-top:16px;">
          ${text([
            'PGRST003 에러는 PostgREST Connection Pool에서 연결을 획득하지 못해 타임아웃이 발생했다는 것을 의미합니다.',
            '따라서 분석 3에서 추정한 공유 자원이 DB Connection Pool이라는 것을 확인하였습니다.',
          ])}
        </div>
      `)}
      ${subLabel('분석 5 : Connection Pool에 비해 과도한 DB 요청 구조', `
        ${text([
          'CloudWatch Log Insight를 사용해 PGRST003 에러가 발생한 로그를 분석하였습니다.',
        ])}
        ${imageUrl('../../assets/images/bottleneck_experiments/v5/v5-log-insight-pgrst003.png', 'CloudWatch Log Insight PGRST003 에러 로그 분석')}
        <div style="margin-top:20px;">
          ${text([
            '그 결과 tools.intervention_tools, tools.emotion_tools, scoring.behavior_adjuster에서 동시에 PGRST003 에러가 발생했다는 것을 확인했습니다.',
            '이에 따라 메시지 처리 과정에서 DB 요청이 어떻게 수행되는지 코드를 확인하였고, 그 결과 asyncio.gather를 통해 메시지 1건 처리시 8개의 DB 요청이 동시 수행됨을 확인했습니다.',
            '또한 이번 버전에서는 Coroutine을 통해 여러 메시지를 동시에 처리하고 있었기 때문에 메시지당 병렬 DB 요청과 메시지간 동시 처리가 결합되어 동시 DB 요청 수가 크게 증가하는 구조를 갖게 된 반면, 확인 결과 Supabase의 Connection Pool Size는 20으로 설정되어 있었습니다.',
            '따라서 Connection Pool 크기에 비해 동시에 발생하는 DB 요청의 수가 과도해 Connection Pool 고갈이 발생한 것으로 판단하였습니다.',
          ])}
        </div>
      `)}
      ${subLabel('최종 판단', `
        ${text([
          '분석 결과, task 수 증가에도 처리량이 크게 향상되지 않은 원인은 DB Connection Pool이 병목이었기 때문이라고 판단하였습니다.',
          'rule-worker는 메시지 1건을 처리할 때 다수의 DB 요청을 병렬로 실행하며, 동시에 Coroutine을 통해 여러 메시지를 동시에 처리하면서 Connection Pool에 비해 과도한 DB 요청이 발생했습니다. 이로 인해 API 서버와 rule-worker가 DB Connection Pool을 경쟁적으로 사용하게 되었고, 그 결과 요청 대기 시간이 증가하면서 처리량이 제한되었습니다.',
        ])}
      `)}
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      ${text([
        '현재 구조에서는 rule-worker의 task 수를 증가시키는 것만으로는 병목을 해결할 수 없다고 판단하였습니다.',
        '따라서 메시지 처리 과정의 DB 호출 수를 줄이는 방향으로 구조를 개선하고 필요시 Connection Pool Size 조정을 검토하기로 결정하였습니다.',
      ])}
    `),
  ]
};
