import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v4.3',
  title: 'Auto Scaling Scale-in 정책 지표 변경 및 개선',
  status: 'in progress',
  tags: ['Auto Scaling', 'CloudWatch'],
  prev: '4.2',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text('rule-worker의 Auto Scaling 정책을 동일한 SQS NumberOfMessagesSent 지표 기반으로 재구성하여 Scale-out과 Scale-in이 동일한 기준으로 동작하도록 변경하였습니다.')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      <p class="body-text">이전 버전에서 NumberOfMessagesSent 기반 Scale-out 정책을 적용해 메시지 유입량 증가를 빠르게 감지할 수 있도록 개선하였습니다. 점진적 부하 테스트에서 Desired Count가 안정적으로 유지되지 않고 Scale-out과 Scale-in이 반복적으로 발생하였고, 이벤트 로그 분석 결과 두 정책이 서로 다른 지표를 기반으로 동작하면서 정책 충돌이 발생했다는 것을 확인했습니다. 따라서 정책 충돌을 방지하기 위해 Scale-out과 Scale-in 기준 지표를 재검토하였습니다.</p>
      <div style="margin-top:20px;">
        ${imageUrl('../../assets/images/bottleneck_experiments/v9/v9-event-queue-sent-deleted.png', 'event-queue Sent/Deleted 그래프')}
      </div>
      <div style="margin-top:20px;">
        ${imageUrl('../../assets/images/bottleneck_experiments/v9/v9-event-queue-visible.png', 'event-queue Visible 그래프')}
      </div>
      <p class="body-text" style="margin-top:12px;">Scale-out 기준으로 사용한 NumberOfMessagesSent는 메시지 유입량을 직접 반영하여 부하 증가를 빠르게 감지할 수 있었지만, Scale-in 기준으로 사용한 ApproximateNumberOfMessagesVisible은 부하 테스트 동안 대부분 낮은 수준으로 유지되어, 메시지 적체 여부를 판단하는 기준으로 활용하기 어려웠습니다. 따라서 부하 증가와 감소를 동일한 기준으로 판단할 수 있도록 Scale-out과 Scale-in 모두 NumberOfMessagesSent를 기준으로 구성하였습니다. 또한 Scale-out과 Scale-in 조건이 동시에 만족되지 않도록 기준값 사이에 차이를 두었으며, 불필요한 축소로 인한 Desired Count 변동을 최소화하기 위해 Scale-in 기준을 Scale-out 기준보다 낮게 설정하였습니다.</p>
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${subLabel('Scale-in 기준 변경 검증', `
        ${text('변경한 Scale-in 정책이 기존 Scale-out 정책과 함께 동작할 때 정책 충돌이 발생하지 않는지 확인하기 위해 rule-worker Auto Scaling 동작 검증 테스트를 수행하였습니다. 이전 버전과 동일한 점진적 부하 테스트 환경에서 진행하였으며, rule-worker Auto Scaling 동작에 집중하기 위해 AI Worker를 비활성화한 상태에서 테스트를 진행하였습니다.')}
        ${text('변경된 Auto Scaling 정책은 다음과 같습니다.')}
        ${table({
          head: ['항목', '설정'],
          rows: [
            { cells: ['Metric', 'NumberOfMessagesSent'] },
            { cells: ['Threshold', '< 300'] },
            { cells: ['Scale-in Step', '-1 task'] },
            { cells: ['Cooldown', '120초'] },
          ]
        })}
        <p class="body-text" style="margin-top:20px;">변경한 Scale-in 정책 적용 후 Desired Count의 변화는 다음과 같이 관측되었습니다.</p>
        <div style="margin-top:20px;">
          ${table({
            head: ['시간', '정책', 'Desired Count'],
            rows: [
              { cells: ['10:16', 'Sent Scale-out', '1 → 4'] },
              { cells: ['10:19', 'Visible Scale-out', '4 → 7'] },
              { cells: ['10:21', 'Sent Scale-out', '7 → 9'] },
              { cells: ['10:23', 'Sent Scale-in', '9 → 6'] },
              { cells: ['10:25', 'Sent Scale-in', '6 → 5'] },
            ]
          })}
        </div>
        <p class="body-text" style="margin-top:20px;">이벤트 로그 분석 결과, 이전 버전에서 발생했던 Scale-out과 Scale-in 정책의 반복적인 교차 실행은 발생하지 않았습니다. 부하 증가 구간에서는 Scale-out 정책이 순차적으로 수행되어 Desired Count가 안정적으로 증가하였으며, 이후 부하 감소 시점에서만 Scale-in 정책이 수행되는 것을 확인하였습니다. 이를 통해 Scale-in 기준 변경으로 정책 충돌이 제거된 것을 확인하였습니다.</p>
      `)}
      ${subLabel('전체 Pipeline 부하 테스트', `
        ${text('Scale-in 기준 변경 검증이 완료된 이후 AI Worker를 다시 활성화한 후, 변경된 Auto Scaling 정책에 전체 Pipeline에서도 정상적으로 동작하는지 확인하기 위하여 베이스라인 테스트와 점진적 부하 테스트를 수행하였습니다. 테스트 시나리오와 부하 조건은 이전 버전과 동일하게 유지하여 Auto Scaling 정책 변경에 따른 영향만 비교할 수 있도록 하였습니다.')}
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.3', '1.93', '0%'] },
            { cells: ['2', '0.83', '1.02', '0%'] },
            { cells: ['3', '0.83', '1.05', '0%'] },
            { cells: ['4', '0.98', '1.11', '0%'] },
            { cells: ['5', '0.93', '1.11', '0%'] },
            { cells: ['6', '0.85', '1.05', '0%'] },
            { cells: ['7', '0.83', '0.97', '0%'] },
            { cells: ['8', '0.89', '1.22', '0%'] },
            { cells: ['9', '0.89', '1.16', '0%'] },
            { cells: ['10', '0.82', '1.09', '0%'] },
            { cells: ['평균 (2~10회)', '0.87', '1.09', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '0.84'] },
              { cells: ['p95', '1.43'] },
              { cells: ['에러율', '0%'] },
            ]
          })}
          <div style="margin-top:20px;">
            ${table({
              head: ['VU', 'avg', 'p95', '상태'],
              rows: [
                { cells: ['0→10', '1.05', '1.99', '안정'] },
                { cells: ['10', '0.87', '1.45', '안정'] },
                { cells: ['30', '0.86', '1.48', '안정'] },
                { cells: ['50', '0.83', '1.37', '안정'] },
                { cells: ['100', '0.83', '1.40', '안정'] },
              ]
            })}
          </div>
        `)}
        <p class="body-text" style="margin-top:20px;">전 구간에서 안정상태로 확인되었습니다.</p>
        ${badge('rule-worker 관련 cloudwatch 지표', `
          ${table({
            head: ['시간', '정책', 'Desired Count'],
            rows: [
              { cells: ['17:37', 'Sent Scale-out', '1 → 4'] },
              { cells: ['17:40', 'Sent Scale-out', '4 → 7'] },
              { cells: ['17:42', 'Sent Scale-out', '7 → 9'] },
              { cells: ['17:44', 'Sent Scale-in', '9 → 6'] },
              { cells: ['17:47', 'Sent Scale-in', '6 → 5'] },
            ]
          })}
          <p class="body-text" style="margin-top:12px;">변경한 Auto Scaling 정책 적용 후 Desired Count는 이전 버전과 달리 Scale-out과 Scale-in이 반복되지 않았습니다. 또한 부하 증가에 따라 Desired Count가 순차적으로 증가하고, 부하 감소 시에만 Scale-in이 수행되는 것을 확인할 수 있었습니다.</p>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v10/v10-event-queue-taskcount.png', 'event-queue Task Count 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v10/v10-rule-worker-cpu-memory.png', 'rule-worker CPU/Memory 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">LiveTaskCount는 부하 증가 구간에서 증가하였으며, CPU Utilization은 Scale-out이 수행되기 직전 일시적으로 100%에 도달하였습니다. 이후 Task 수가 증가하면서 CPU Utilization은 감소하였습니다.</p>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v10/v10-event-queue-oldest.png', 'event-queue Oldest Message 그래프')}
          </div>
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v10/v10-event-queue-visible.png', 'event-queue Visible 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">event-queue의 ApproximateAgeOfOldestMessage와 ApproximateNumberOfMessagesVisible은 100 VU 구간에서 가장 높은 값을 기록하였으며, Scale-out 이후 다시 감소하는 것을 확인하였습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${text([
        '이전 버전에서 발생했던 Desired Count의 반복적인 증감 현상은 발생하지 않았으며, Scale-out과 Scale-in이 부하 변화에 따라 순차적으로 수행되는 것을 확인하였습니다. 이를 통해 서로 다른 지표를 사용하여 발생했던 Auto Scaling 정책 충돌은 해결된 것으로 판단하였습니다.',
        '다만 Scale-out이 수행되기 전 CPU Utilization이 일시적으로 100%에 도달하는 구간이 확인되었습니다. 또한 CPU Utilization 상승 시점과 Desired Count 변경, Task 생성 시점을 비교한 결과, 부하 감지부터 실제 Scale-out 적용까지 수 분의 반응 시간이 발생하는 것을 확인하였습니다. 이는 CloudWatch 기반 Auto Scaling이 Metric 수집, Alarm 평가, ECS Task 생성 과정을 순차적으로 진행하기 때문에 실제 Scale-out 적용까지 일정 시간이 소요되기 때문이라고 판단하였습니다.',
        '해당 지연을 줄이기 위해 Threshold를 더 낮추거나 최소 Task 수를 증가시키는 방법도 고려할 수 있으나, 불필요한 Scale-out이나 운영 비용 증가가 발생할 수 있습니다. 따라서 현재 정책 구성을 유지한 상태에서 다음 단계의 부하 테스트를 진행하기로 결정하였습니다.',
      ])}
    `),

    // 06 추가 검증 계획
    section(6, '추가 검증 계획', `
      ${text([
        'AI Worker는 외부 API의 Rate Limit이 처리량을 제한하는 주요 원인으로 확인되어 Worker 수를 추가로 조정하더라도 처리량 향상을 기대하기 어려웠습니다. 또한 rule-worker는 Auto Scaling 정책 충돌은 해결되었으나, 남아있는 CPU Utilization 상승은 CloudWatch 기반 Auto Scaling의 반응 시간에 따른 특성으로 판단하였습니다. 이를 더 줄이기 위해서는 Threshold 조정이나 최소 Task 수 증가가 필요하지만, 불필요한 Scale-out이나 운영 비용 증가가 발생할 수 있으므로 추가 정책 변경은 진행하지 않았습니다.',
        '따라서 현재 구조와 Auto Scaling 정책을 기준으로 점진적 부하 테스트를 마무리하고, 급격한 부하 변화와 장시간 부하 환경에서도 안정적으로 동작하는지 검증하기 위해 Spike Test와 Soak Test를 수행하기로 결정하였습니다.',
      ])}
    `),
  ]
};
