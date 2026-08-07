import { section, text, image, imageUrl, imageGrid, subLabel, badge, table, criteriaGrid, tooltip, note } from '../components/render.js';

export default {
  version: 'v4.2',
  title: 'Auto Scaling Scale-out 정책 지표 변경',
  status: 'shipped',
  tags: ['Auto Scaling', 'CPU Utilization', 'NumberOfMessagesSent'],
  prev: '4.1',
  next: '4.3',

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text('rule-worker의 Auto Scaling 정책 중 CPU Utilization 기반 정책을 제거하고, SQS NumberOfMessagesSent 기반 정책을 추가하였습니다.')}
    `),

    // 02 개선 배경
    section(2, '개선 배경', `
      <p class="body-text">CPU Utilization 기반 정책은 부하가 증가한 이후 변화하는 지표이기 때문에 Auto Scaling에 반영되기까지 다소의 지연이 발생했습니다. 이에 따라 보다 빠르게 부하를 감지할 수 있는 Scale-out 기준이 필요하다고 판단하였습니다.</p>
      <p class="body-text" style="margin-top:12px;">기존 Scale-out 기준으로 사용하던 ApproximateNumberOfMessagesVisible 지표는 큐에 메시지가 쌓인 이후 증가하는 지표였습니다. 따라서 추가적인 지표는 메시지 유입량을 먼저 감지 할 수 있어야 했고 따라서 NumberOfMessagesSent를 지표로 선정하여 부하 증가를 빠르게 감지해 Scale-out을 수행하도록 하였습니다.</p>
    `),

    // 03 실험 설계
    section(3, '실험 설계', `
      ${text('Scale-out Auto Scaling 정책을 제외한 모든 실험 조건은 이전 버전과 동일하게 유지하여 부하테스트를 수행하였습니다.')}
      ${subLabel('Scale-out 정책 설정', `
        ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-event-queue-sent-deleted.png', 'event-queue Sent/Deleted 그래프')}
        <div style="margin-top:20px;">
          ${imageUrl('../../assets/images/bottleneck_experiments/v8/v8-rule-worker-cpu-memory.png', 'rule-worker CPU/Memory 그래프')}
        </div>
        ${table({
          head: ['항목', '설정'],
          rows: [
            { cells: ['Metric', 'NumberOfMessagesSent'] },
            { cells: ['Threshold', '1000'] },
            { cells: ['Step Scaling', '+3 tasks'] },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">Scale-out Threshold는 이전 부하 테스트 결과를 기반으로 선정하였습니다. 기존 테스트에서 Worker CPU Utilization 70~80% 구간을 처리 한계에 근접한 임계 구간으로 정의하였기 때문에 해당 구간에 도달했을 때의 SQS NumberOfMessagesSent 값을 확인 후, 이를 기반으로 1분 동안 1,000개 이상의 메시지가 유입되는 경우 Scale-out이 수행되도록 Threshold를 설정하였습니다.</p>
      `)}
    `),

    // 04 실험 결과
    section(4, '실험 결과', `
      ${subLabel('베이스라인 테스트', `
        ${table({
          head: ['회차', 'avg (s)', 'p95 (s)', '에러율'],
          rows: [
            { cells: ['1', '1.89', '3.05', '0%'] },
            { cells: ['2', '1.29', '1.70', '0%'] },
            { cells: ['3', '0.86', '1.09', '0%'] },
            { cells: ['4', '1.26', '1.76', '0%'] },
            { cells: ['5', '1.18', '1.51', '0%'] },
            { cells: ['6', '0.79', '1.01', '0%'] },
            { cells: ['7', '0.88', '1.21', '0%'] },
            { cells: ['8', '1.18', '1.60', '0%'] },
            { cells: ['9', '1.15', '1.45', '0%'] },
            { cells: ['10', '1.05', '1.53', '0%'] },
            { cells: ['평균 (2~10회)', '1.07', '1.43', '0%'], highlight: true },
          ]
        })}
        <p class="body-text" style="margin-top:12px;">1회차를 cold start로 추정하여 제외하였습니다. 데이터가 안정된 2~10회차 평균을 베이스라인으로 설정하였습니다.</p>
      `)}
      ${subLabel('점진적 부하 테스트', `
        ${badge('애플리케이션 지표', `
          ${table({
            head: ['지표', '결과'],
            rows: [
              { cells: ['avg', '1.09'] },
              { cells: ['p95', '1.48'] },
              { cells: ['에러율', '0%'] },
            ]
          })}
          <div style="margin-top:20px;">
            ${table({
              head: ['VU', 'avg', 'p95', '상태'],
              rows: [
                { cells: ['0→10', '1.41', '2.20', '안정'] },
                { cells: ['10', '1.15', '1.62', '안정'] },
                { cells: ['30', '1.08', '1.49', '안정'] },
                { cells: ['50', '1.08', '1.39', '안정'] },
                { cells: ['100', '1.08', '1.47', '안정'] },
              ]
            })}
          </div>
          <p class="body-text" style="margin-top:12px;">전 구간에서 안정상태로 확인되었습니다.</p>
        `)}
        ${badge('rule-worker 관련 CloudWatch 지표', `
          ${imageUrl('../../assets/images/bottleneck_experiments/v9/v9-rule-worker-task-count.png', 'rule-worker Task Count 그래프')}
          <div style="margin-top:20px;">
            ${imageUrl('../../assets/images/bottleneck_experiments/v9/v9-rule-worker-memory-cpu.png', 'rule-worker CPU/Memory 그래프')}
          </div>
          <p class="body-text" style="margin-top:12px;">LiveTaskCount 확인 결과 scale-out이 이전 버전보다 빠르게 증가하는 것을 확인했습니다.<br>CPU Utilization는 일시적으로 100%에 도달하였으나, Task 증가 시점에 맞추어 이전보다 빠르게 감소하는 것을 확인하였습니다.</p>
        `)}
      `)}
    `),

    // 05 판단 및 이유
    section(5, '판단 및 이유', `
      ${table({
        head: ['시간', '정책', 'Scaling Adjustment'],
        rows: [
          { cells: ['15:07', 'Sent Scale-out', '+3'] },
          { cells: ['15:08', 'Visible Scale-in', '-1'] },
          { cells: ['15:08', 'Sent Scale-out', '+3'] },
          { cells: ['15:10', 'Visible Scale-in', '-1'] },
          { cells: ['15:10', 'Sent Scale-out', '+3'] },
          { cells: ['15:11', 'Visible Scale-in', '-1'] },
          { cells: ['15:11', 'Sent Scale-out', '+3'] },
          { cells: ['15:12', 'Visible Scale-in', '-1'] },
          { cells: ['15:12', 'Sent Scale-out', '+3'] },
          { cells: ['15:13', 'Visible Scale-in', '-1'] },
          { cells: ['15:13', 'Sent Scale-out', '+3'] },
        ]
      })}
      <p class="body-text" style="margin-top:16px;">LiveTaskCount 증가시점과 CPU Utilization 변화를 통해 이전 버전에서 사용했던 CPU Utilization 기반 정책 보다 이번 버전의 NumberOfMessagesSent 기반 정책이 빠른 Scale-out 대응에 적합하다고 판단하였습니다.</p>
      <p class="body-text" style="margin-top:12px;">하지만 테스트 과정에서 CPU Utilization이 일시적으로 100%에 도달하였으며, Desired Count 또한 안정적으로 유지되지 않는 현상이 발생하였습니다. 또한 이벤트 로그 분석 결과 Scale-out과 Scale-in 정책이 번갈아 실행되며 Desired Count 변경이 반복되는 현상을 확인하였습니다.</p>
      <p class="body-text" style="margin-top:12px;">따라서 이번 문제는 Scale-out 기준으로 선정한 NumberOfMessagesSent의 문제가 아니라, Scale-out과 Scale-in 정책이 서로 다른 특성의 지표를 기반으로 동작하면서 발생한 정책 구성 문제라고 판단하였습니다.</p>
    `),

    // 06 개선 방향
    section(6, '개선 방향', `
      <p class="body-text">Scale-out과 Scale-in 정책이 서로 충돌하지 않도록 Auto Scaling 정책을 다시 구성하기로 결정했습니다.</p>
      <p class="body-text" style="margin-top:12px;">또한 Desired Count가 안정적으로 증가할 수 있도록 각 정책의 기준을 함께 조정하기로 했습니다.</p>
    `),
  ]
};
