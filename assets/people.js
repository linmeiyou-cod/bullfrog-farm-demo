// 人员与工资均为虚构资料。一个人的资料可以关联到多个场地。
window.DEMO_PEOPLE = [
  {
    id: 'P-01', name: '张三', age: 38, role: '场地主管', monthlySalary: 8200,
    work: '安排榕城两处场地的日常巡检、人员排班和交接。',
    farmIds: ['JY-01', 'JY-02'],
  },
  {
    id: 'P-02', name: '李四', age: 31, role: '养殖员', monthlySalary: 5600,
    work: '负责日常饲喂、场地清洁和养殖记录。',
    farmIds: ['JY-01'],
  },
  {
    id: 'P-03', name: '王五', age: 42, role: '设备维护员', monthlySalary: 6500,
    work: '检查供水、通风及照明设备，登记并跟进故障。',
    farmIds: ['JY-01', 'JY-03'],
  },
  {
    id: 'P-04', name: '赵六', age: 34, role: '养殖员', monthlySalary: 5800,
    work: '负责日常饲喂和卫生检查，记录场地交接事项。',
    farmIds: ['JY-02', 'JY-03'],
  },
  {
    id: 'P-05', name: '孙七', age: 40, role: '场地主管', monthlySalary: 7900,
    work: '安排值班，检查物料库存并协调补给。',
    farmIds: ['ZJ-01', 'ZJ-02'],
  },
  {
    id: 'P-06', name: '周八', age: 29, role: '养殖员', monthlySalary: 5400,
    work: '负责饲喂、用料登记和每日场地清洁。',
    farmIds: ['ZJ-02', 'ZJ-03'],
  },
  {
    id: 'P-07', name: '吴九', age: 35, role: '巡检员', monthlySalary: 6300,
    work: '巡查场地设施，记录异常并通知值班人员处理。',
    farmIds: ['NN-01', 'NN-02'],
  },
  {
    id: 'P-08', name: '郑十', age: 32, role: '养殖员', monthlySalary: 5500,
    work: '负责日常饲喂，记录用料和卫生情况。',
    farmIds: ['NN-03', 'NN-04'],
  },
  {
    id: 'P-09', name: '陈一', age: 43, role: '场地主管', monthlySalary: 7600,
    work: '安排生产巡查和场地交接，跟进维修事项。',
    farmIds: ['CD-01'],
  },
  {
    id: 'P-10', name: '刘二', age: 37, role: '设备维护员', monthlySalary: 6200,
    work: '检查供水和通风设备，整理维护记录。',
    farmIds: ['WH-01'],
  },
  {
    id: 'P-11', name: '何三', age: 33, role: '养殖员', monthlySalary: 5700,
    work: '负责饲喂、场地清洁和班次交接。',
    farmIds: ['WF-01'],
  },
];
