import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusPill from '@/components/common/StatusPill.vue'

describe('StatusPill', () => {
  it('按状态映射中文文案与色调', () => {
    const wrapper = mount(StatusPill, { props: { status: 'pending' } })
    expect(wrapper.text()).toContain('待审核')
    expect(wrapper.classes()).toContain('tone-warning')
  })

  it('支持覆盖展示文案', () => {
    const wrapper = mount(StatusPill, {
      props: { status: 'approved', label: '使用中' }
    })
    expect(wrapper.text()).toContain('使用中')
    expect(wrapper.text()).not.toContain('在借')
  })

  it('未知状态回退为原值并使用信息色', () => {
    const wrapper = mount(StatusPill, { props: { status: 'unknown-status' } })
    expect(wrapper.text()).toContain('unknown-status')
    expect(wrapper.classes()).toContain('tone-info')
  })

  it('size 属性生成对应尺寸类', () => {
    const wrapper = mount(StatusPill, { props: { status: 'returned', size: 'sm' } })
    expect(wrapper.classes()).toContain('size-sm')
  })
})
