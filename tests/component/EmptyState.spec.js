import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EmptyState from '@/components/common/EmptyState.vue'

const ElButtonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

describe('EmptyState', () => {
  it('渲染标题与描述', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无申请', description: '去设备大厅挑一台设备吧' },
      global: { stubs: { 'el-button': ElButtonStub } }
    })
    expect(wrapper.text()).toContain('暂无申请')
    expect(wrapper.text()).toContain('去设备大厅挑一台设备吧')
  })

  it('点击操作按钮时派发 action 事件', async () => {
    const wrapper = mount(EmptyState, {
      props: { title: '空', actionText: '去借设备' },
      global: { stubs: { 'el-button': ElButtonStub } }
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('compact 模式添加对应类名', () => {
    const wrapper = mount(EmptyState, {
      props: { compact: true },
      global: { stubs: { 'el-button': ElButtonStub } }
    })
    expect(wrapper.classes()).toContain('compact')
  })
})
