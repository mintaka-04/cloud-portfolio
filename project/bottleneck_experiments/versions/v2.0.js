import { section, text, imageUrl, subLabel, badge, table, criteriaGrid } from '../components/render.js';

export default {
  version: 'v2.0',
  title: '',
  status: 'in progress',
  tags: [],
  prev: '1.1',
  next: null,

  sections: [

    // 01 아키텍처
    section(1, '아키텍처', `
      ${text([
        'EC2 기반으로 동작하던 인스턴스들을 ECS Fargate 기반의 아키텍처로 전환하였습니다.',
        'Main은 단일 Task로 유지하였으며, Worker는 ECS Service로 구성하여 부하에 따라 수가 자동으로 증감하도록 Autoscaling을 적용하였습니다.',
      ])}
      ${imageUrl('../../assets/images/bottleneck_experiments/v3/v3-diagram.png', 'v2.0 아키텍처 다이어그램')}
    `),
  ]
};
